import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.budii_alert import PatientAlert

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

    for action in payload.actions:
        new_alert = PatientAlert(
            patient_id=payload.patient_id,
            event_id=payload.event_id,
            case=action.case,
            alert_type=action.action,
            title=action.case.replace("_", " ").title(),
            message=action.reason or "Budii generated alert",
            status="active",
            source="budii",
        )
        if action.case != "SOS_TRIGGER":    
            db.add(new_alert)
            db.flush()

            alert_data = new_alert.to_dict()
            created_alerts.append(alert_data)

            await sio.emit("new_alert", alert_data)

    db.commit()

    return {
        "status": "received",
        "alerts_created": len(created_alerts),
        "alerts": created_alerts,
    }