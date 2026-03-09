import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


# GET /api/audit-logs
@router.get("/")
def list_audit_logs(
    userId: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if userId:
        query = query.filter(AuditLog.user_id == uuid.UUID(userId))
    logs = query.order_by(AuditLog.created_at.desc()).limit(50).all()
    return [l.to_dict() for l in logs]


# POST /api/audit-logs
@router.post("/", status_code=201)
def create_audit_log(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = body.get("user_id") or current_user["userId"]
    log = AuditLog(
        user_id=uuid.UUID(user_id),
        action=body["action"],
        entity_type=body.get("entity_type"),
        entity_id=body.get("entity_id"),
        metadata_=body.get("metadata"),
        ip_address=body.get("ip_address"),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log.to_dict()
