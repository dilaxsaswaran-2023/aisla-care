import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.gps_location import GpsLocation
from app.auth import get_current_user
from app.utils.agent_publisher import publish_sos_to_agent

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# Request models
class SOSAlertRequest(BaseModel):
    voice_transcription: str | None = None
    message: str | None = None


# GET /api/alerts
@router.get("/")
def list_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(50).all()
    return [a.to_dict() for a in alerts]


# POST /api/alerts
@router.post("/", status_code=201)
def create_alert(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = Alert(
        patient_id=uuid.UUID(body["patient_id"]),
        alert_type=body["alert_type"],
        status=body.get("status", "active"),
        priority=body.get("priority", "medium"),
        title=body["title"],
        message=body.get("message", ""),
        latitude=body.get("latitude"),
        longitude=body.get("longitude"),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Audit log
    audit = AuditLog(
        user_id=uuid.UUID(current_user["userId"]),
        action=f"{alert.alert_type}_alert_created",
        entity_type="alert",
        entity_id=str(alert.id),
        metadata_={"priority": alert.priority},
    )
    db.add(audit)
    db.commit()

    return alert.to_dict()


# PATCH /api/alerts/:id
@router.patch("/{alert_id}")
def update_alert(
    alert_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == uuid.UUID(alert_id)).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    for key in ["status", "priority", "title", "message", "latitude", "longitude"]:
        if key in body:
            setattr(alert, key, body[key])

    db.commit()
    db.refresh(alert)
    return alert.to_dict()


# POST /api/alerts/sos
@router.post("/sos", status_code=201)
def sos_alert(
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

    alert = Alert(
        patient_id=user_id,
        alert_type="sos",
        status="active",
        priority="critical",
        title="SOS Emergency Alert",
        message=body.message or "Patient triggered SOS button",
        voice_transcription=body.voice_transcription,
        latitude=latest_gps.latitude if latest_gps else None,
        longitude=latest_gps.longitude if latest_gps else None,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    audit = AuditLog(
        user_id=user_id,
        action="sos_alert_created",
        entity_type="alert",
        entity_id=str(alert.id),
        metadata_={"priority": "critical", "has_voice": bool(body.voice_transcription)},
    )
    db.add(audit)
    db.commit()

    # Publish SOS event to agent (port 8000) for processing
    publish_sos_to_agent(str(user_id), body.voice_transcription)

    return alert.to_dict()
