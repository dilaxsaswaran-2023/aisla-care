import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient_alert import PatientAlert
from app.models.user import User
from app.services.audit_log_service import log_audit_event
from app.services.firebase_helper import push_patient_alert
from app.services.patient_alert_relationship_service import create_patient_alert_relationships

logger = logging.getLogger("aisla.budii")

router = APIRouter(prefix="/api/internal", tags=["Internal Budii"])


class BudiiRuleResult(BaseModel):
    triggered: bool | None = None
    case: str | None = None
    action: str | None = None
    reason: str | None = None


class BudiiAction(BaseModel):
    case: str
    action: str
    reason: str | None = None


class BudiiResult(BaseModel):
    triggered: bool
    rules_triggered: List[BudiiRuleResult] = Field(default_factory=list)


class BudiiAlertPayload(BaseModel):
    event_id: str
    patient_id: str
    result: BudiiResult
    actions: List[BudiiAction] = Field(default_factory=list)


@router.post("/budii-alert")
async def receive_budii_alert(
    payload: BudiiAlertPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    logger.info(
        f"[BUDII] Received event_id={payload.event_id} "
        f"patient_id={payload.patient_id} actions={payload.actions}"
    )

    internal_key = request.headers.get("X-Internal-Key")
    if internal_key != "budii-secret-123":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not payload.actions:
        return {"status": "ignored", "reason": "no actions"}

    created_alerts = []
    sio = request.app.state.sio
    patient_user = db.query(User).filter(User.id == payload.patient_id).first()

    for action in payload.actions:
        new_alert = PatientAlert(
            patient_id=payload.patient_id,
            event_id=payload.event_id,
            case=action.case,
            title=f"Budii Alert - {action.case}",
            alert_type=action.case,
            message=action.reason,
            status="active",
            source="budii",
        )
        if action.case != "SOS_TRIGGER":    
            db.add(new_alert)
            db.flush()

            create_patient_alert_relationships(db, new_alert.id, payload.patient_id)

            alert_data = new_alert.to_dict()
            alert_data["patient_name"] = patient_user.full_name if patient_user else "Unknown"
            created_alerts.append(alert_data)

            push_patient_alert(alert_data)

            await sio.emit("new_alert", alert_data)

    db.commit()

    for created in created_alerts:
        log_audit_event(
            db,
            action="budii_internal_alert_created",
            event_type="budii_alerts",
            entity_type="patient_alert",
            entity_id=created.get("id"),
            patient_id=payload.patient_id,
            summary="Budii internal alert created",
            details="Internal Budii ingestion created a patient alert entry.",
            context={
                "event_id": payload.event_id,
                "alert_type": created.get("alert_type"),
                "source": "internal_budii",
            },
        )

    return {
        "status": "received",
        "alerts_created": len(created_alerts),
        "alerts": created_alerts,
    }