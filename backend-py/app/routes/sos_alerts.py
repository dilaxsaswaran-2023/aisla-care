import logging
import uuid
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.gps_location import GpsLocation
from app.models.patient_alert import PatientAlert
from app.models.sos_alert import SosAlert
from app.models.user import User
from app.services.audit_log_service import log_audit_event
from app.services.firebase_helper import push_patient_alert
from app.services.patient_alert_relationship_service import create_patient_alert_relationships
from app.services.sos_priority_service import get_sos_priority

logger = logging.getLogger("sos_alerts.router")
router = APIRouter(prefix="/api/sos-alerts", tags=["sos-alerts"])


class SOSAlertRequest(BaseModel):
    voice_transcription: str | None = None
    message: str | None = None


def check_sos_repeat(sos_alert: SosAlert, db: Session) -> str:
    current_time = sos_alert.created_at
    if current_time.tzinfo is not None:
        current_time = current_time.astimezone(timezone.utc).replace(tzinfo=None)

    last_sos = (
        db.query(SosAlert)
        .filter(
            SosAlert.patient_id == sos_alert.patient_id,
            SosAlert.id != sos_alert.id,
        )
        .order_by(desc(SosAlert.created_at))
        .first()
    )

    if not last_sos:
        return "SOS_TRIGGER"

    last_time = last_sos.created_at
    if last_time.tzinfo is not None:
        last_time = last_time.astimezone(timezone.utc).replace(tzinfo=None)

    diff = int((current_time - last_time).total_seconds())
    return "SOS_REPEAT" if diff <= 480 else "SOS_TRIGGER"


@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_sos_alert(
    request: Request,
    body: SOSAlertRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])

    latest_gps = (
        db.query(GpsLocation)
        .filter(GpsLocation.user_id == user_id)
        .order_by(GpsLocation.created_at.desc())
        .first()
    )

    sos_alert = SosAlert(
        patient_id=user_id,
        event_id=str(uuid.uuid4()),
        alert_type="sos",
        message=body.message or "Patient triggered SOS button",
        priority=get_sos_priority(body.voice_transcription or "") or "high",
    )
    db.add(sos_alert)
    db.flush()

    sos_case = check_sos_repeat(sos_alert, db)

    if sos_case == "SOS_REPEAT":
        sos_alert.is_patient_alert = True
        patient_alert = PatientAlert(
            patient_id=user_id,
            event_id=str(sos_alert.id),
            case="SOS_REPEAT",
            title="SOS Alert - Repeated Trigger",
            alert_type="SOS_REPEAT",
            message=body.message or "Repeated SOS detected within 8 minutes",
            status="active",
            source="sos",
        )
        db.add(patient_alert)
        db.flush()
        create_patient_alert_relationships(db, patient_alert.id, user_id)

    db.commit()
    db.refresh(sos_alert)

    log_audit_event(
        db,
        action="sos_triggered",
        event_type="sos_alerts",
        entity_type="sos_alert",
        entity_id=str(sos_alert.id),
        current_user=current_user,
        patient_id=user_id,
        summary="SOS alert triggered",
        details="Patient triggered SOS and an SOS alert record was created.",
        context={
            "sos_case": sos_case,
            "priority": sos_alert.priority,
            "latitude": latest_gps.latitude if latest_gps else None,
            "longitude": latest_gps.longitude if latest_gps else None,
            "voice_transcription": bool(body.voice_transcription),
        },
        severity="critical",
    )

    if sos_case == "SOS_REPEAT":
        patient_user = db.query(User).filter(User.id == user_id).first()
        pa_payload = {
            "id": str(patient_alert.id),
            "patient_id": str(user_id),
            "event_id": str(sos_alert.id),
            "alert_type": "SOS_REPEAT",
            "title": "SOS Alert - Repeated Trigger",
            "is_read": False,
            "created_at": patient_alert.created_at.isoformat() if patient_alert.created_at else None,
            "updated_at": patient_alert.updated_at.isoformat() if patient_alert.updated_at else None,
            "patient_name": patient_user.full_name if patient_user else "Unknown",
        }
        push_patient_alert(pa_payload)

    sio = getattr(request.app.state, "sio", None)
    if sio:
        try:
            await sio.emit(
                "new_sos_alert",
                {
                    "patient_id": str(user_id),
                    "sos_alert_id": str(sos_alert.id),
                    "alert_type": "sos",
                    "sos_case": sos_case,
                },
            )
        except Exception as exc:
            logger.warning(f"[SOS] socket emit failed: {exc}")

    response = sos_alert.to_dict()
    response["sos_case"] = sos_case
    return response


@router.get("/me")
def my_sos_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])

    if current_user.get("role") == "patient":
        rows = (
            db.query(SosAlert)
            .filter(SosAlert.patient_id == user_id)
            .order_by(SosAlert.created_at.desc())
            .limit(100)
            .all()
        )
        return [r.to_dict() for r in rows]

    raise HTTPException(status_code=403, detail="Use /api/alerts/me for caregiver/family alert feed")


@router.patch("/mark-read/{alert_id}")
def mark_sos_alert_read(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    alert = db.query(SosAlert).filter(SosAlert.id == aid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")

    alert.is_read = True
    db.add(alert)
    db.commit()
    return {"success": True}
