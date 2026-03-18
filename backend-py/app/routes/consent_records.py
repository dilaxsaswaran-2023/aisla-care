import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.consent_record import ConsentRecord
from app.models.user import User
from app.auth import get_current_user
from app.services.audit_log_service import log_audit_event

router = APIRouter(prefix="/api/consent-records", tags=["consent-records"])


# GET /api/consent-records
@router.get("/")
def list_consent_records(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = db.query(ConsentRecord).order_by(ConsentRecord.created_at.desc()).all()

    result = []
    for r in records:
        d = r.to_dict()
        # Populate patient and granted_to
        patient = db.query(User).filter(User.id == r.patient_id).first()
        granted = db.query(User).filter(User.id == r.granted_to).first()
        d["patient_id"] = {"_id": str(patient.id), "full_name": patient.full_name, "email": patient.email} if patient else str(r.patient_id)
        d["granted_to"] = {"_id": str(granted.id), "full_name": granted.full_name, "email": granted.email} if granted else str(r.granted_to)
        result.append(d)

    return result


# POST /api/consent-records
@router.post("/", status_code=201)
def create_consent_record(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = ConsentRecord(
        patient_id=uuid.UUID(body["patient_id"]),
        consent_type=body["consent_type"],
        granted_to=uuid.UUID(body["granted_to"]),
        status=body.get("status", "active"),
        expires_at=body.get("expires_at"),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit_event(
        db,
        action="consent_granted",
        event_type="consent",
        entity_type="consent_record",
        entity_id=str(record.id),
        current_user=current_user,
        patient_id=record.patient_id,
        summary="Consent record created",
        details="A consent access record was created or updated.",
        context={
            "consent_type": record.consent_type,
            "granted_to": str(record.granted_to),
            "status": record.status,
            "expires_at": record.expires_at.isoformat() if record.expires_at else None,
        },
    )

    return record.to_dict()
