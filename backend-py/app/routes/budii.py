from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, List

router = APIRouter(prefix="/api/internal", tags=["Internal Budii"])


class BudiiAction(BaseModel):
    type: str
    message: str | None = None
    metadata: Dict[str, Any] | None = None


class BudiiAlertPayload(BaseModel):
    event_id: str
    patient_id: str
    result: Dict[str, Any]
    actions: List[BudiiAction] = []


@router.post("/budii-alert")
async def receive_budii_alert(payload: BudiiAlertPayload, request: Request):
    internal_key = request.headers.get("X-Internal-Key")
    if internal_key != "budii-secret-123":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not payload.actions:
        return {"status": "ignored", "reason": "no actions"}

    created_alerts = []
    sio = request.app.state.sio

    for action in payload.actions:
        alert_data = {
            "patient_id": payload.patient_id,
            "event_id": payload.event_id,
            "type": action.type,
            "title": action.type.replace("_", " ").title(),
            "message": action.message or "Budii generated alert",
            "status": "active",
        }

        # TODO: save alert_data to your alerts table here
        # Example:
        # saved_alert = create_alert(db, alert_data)

        created_alerts.append(alert_data)

        await sio.emit("new_alert", alert_data)

    return {
        "status": "received",
        "alerts_created": len(created_alerts),
        "alerts": created_alerts,
    }