import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String

from app.database import get_db
from app.models.audit_log import AuditLog
from app.auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


def _parse_datetime(value: str, end_of_day: bool = False) -> datetime:
    value = value.strip()
    if "T" in value:
        dt = datetime.fromisoformat(value)
    else:
        dt = datetime.fromisoformat(f"{value}T00:00:00")
        if end_of_day:
            dt = dt + timedelta(days=1)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


# GET /api/audit-logs
@router.get("/")
def list_audit_logs(
    q: str = Query(None),
    userId: str = Query(None),
    patientId: str = Query(None),
    caregiverId: str = Query(None),
    eventType: str = Query(None),
    source: str = Query(None),
    dateFrom: str = Query(None),
    dateTo: str = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    if userId:
        query = query.filter(AuditLog.user_id == _parse_uuid(userId, "userId"))
    if patientId:
        query = query.filter(AuditLog.patient_id == _parse_uuid(patientId, "patientId"))
    if caregiverId:
        query = query.filter(AuditLog.caregiver_id == _parse_uuid(caregiverId, "caregiverId"))
    if eventType:
        query = query.filter(AuditLog.event_type == eventType)
    if source:
        query = query.filter(AuditLog.source == source)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(or_(
            AuditLog.action.ilike(pattern),
            AuditLog.event_type.ilike(pattern),
            AuditLog.entity_type.ilike(pattern),
            AuditLog.entity_id.ilike(pattern),
            AuditLog.source.ilike(pattern),
            cast(AuditLog.user_id, String).ilike(pattern),
            cast(AuditLog.patient_id, String).ilike(pattern),
            cast(AuditLog.caregiver_id, String).ilike(pattern),
            cast(AuditLog.metadata_, String).ilike(pattern),
        ))
    if dateFrom:
        query = query.filter(AuditLog.created_at >= _parse_datetime(dateFrom))
    if dateTo:
        query = query.filter(AuditLog.created_at < _parse_datetime(dateTo, end_of_day=True))

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [l.to_dict() for l in logs]


@router.get("/patient/{patient_id}")
def list_audit_logs_by_patient(
    patient_id: str,
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.patient_id == _parse_uuid(patient_id, "patient_id"))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [l.to_dict() for l in logs]


@router.get("/caregiver/{caregiver_id}")
def list_audit_logs_by_caregiver(
    caregiver_id: str,
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.caregiver_id == _parse_uuid(caregiver_id, "caregiver_id"))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [l.to_dict() for l in logs]


# POST /api/audit-logs
@router.post("/", status_code=201)
def create_audit_log(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = body.get("user_id") or current_user.get("userId")
    patient_id = body.get("patient_id")
    caregiver_id = body.get("caregiver_id")

    log = AuditLog(
        user_id=uuid.UUID(user_id) if user_id else None,
        patient_id=uuid.UUID(patient_id) if patient_id else None,
        caregiver_id=uuid.UUID(caregiver_id) if caregiver_id else None,
        action=body["action"],
        event_type=body.get("event_type") or body.get("entity_type"),
        entity_type=body.get("entity_type"),
        entity_id=body.get("entity_id"),
        source=body.get("source") or "manual",
        metadata_=body.get("metadata"),
        ip_address=body.get("ip_address"),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log.to_dict()
