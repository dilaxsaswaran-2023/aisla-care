import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
import logging
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.models.alert_relationship import AlertRelationship
from app.models.audit_log import AuditLog
from app.models.gps_location import GpsLocation
from app.models.user import User
from app.auth import get_current_user
from app.utils.agent_publisher import publish_sos_to_agent
from app.services.alert_relationship_service import create_alert_relationships

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

logger = logging.getLogger(__name__)


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


# GET /api/alerts/me — returns alerts linked to current user via alert_relationships
@router.get("/me")
def my_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all alerts where the logged-in user appears as caregiver_id or family_id
    in the alert_relationships table. Enriches each alert with the patient's name.
    """
    user_id = uuid.UUID(current_user["userId"])

    # Find all alert_ids linked to this user (as caregiver or family)
    relationships = (
        db.query(AlertRelationship)
        .filter(
            (AlertRelationship.caregiver_id == user_id) |
            (AlertRelationship.family_id == user_id)
        )
        .all()
    )

    print(f"Found {len(relationships)} alert relationships for user {user_id}")

    alert_ids = list({rel.alert_id for rel in relationships})

    if not alert_ids:
        return []

    alerts = (
        db.query(Alert)
        .filter(Alert.id.in_(alert_ids))
        .order_by(Alert.created_at.desc())
        .limit(50)
        .all()
    )

    # Enrich alerts with patient name
    result = []
    for alert in alerts:
        data = alert.to_dict()
        patient = db.query(User).filter(User.id == alert.patient_id).first()
        data["patient_name"] = patient.full_name if patient else "Unknown"
        result.append(data)

    return result




# POST /api/alerts
@router.post("/", status_code=201)
def create_alert(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient_id = uuid.UUID(body["patient_id"])
    
    alert = Alert(
        patient_id=patient_id,
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

    # Create alert relationships for all caregivers and family members
    relationships = create_alert_relationships(db, alert.id, patient_id)

    # Build response with alert and relationships
    response = alert.to_dict()
    response["relationships"] = relationships
    
    return response


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
async def sos_alert(
    body: SOSAlertRequest,
    request: Request,
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

    # Create alert relationships for all caregivers and family members
    relationships = create_alert_relationships(db, alert.id, user_id)

    # Run SOS check to determine if it's SOS_TRIGGER or SOS_REPEAT
    sos_rules = check_sos_direct(alert, db, user_id)

    # If SOS_REPEAT → create PatientAlert, mark alert as emergency, push to Firebase
    sos_case = sos_rules[0]["case"] if sos_rules else None
    if sos_case == "SOS_REPEAT":
        alert.is_added_to_emergency = True
        db.add(alert)

        patient_alert = PatientAlert(
            patient_id=user_id,
            event_id=str(alert.id),
            alert_type="SOS_REPEAT",
        )
        db.add(patient_alert)
        db.flush()
        create_budii_alert_relationships(db, patient_alert.id, user_id)
        db.commit()
        db.refresh(patient_alert)

        # Push to Firebase
        pa_dict = patient_alert.to_dict()
        patient_user = db.query(User).filter(User.id == user_id).first()
        pa_dict["patient_name"] = patient_user.full_name if patient_user else "Unknown"
        push_patient_alert(pa_dict)

    # Emit socket event if available
    sio = getattr(request.app.state, "sio", None)
    if sio and sos_rules:
        try:
            await sio.emit("new_alert", {
                "patient_id": str(user_id),
                "alert_id": str(alert.id),
                "alert_type": "sos",
                "sos_rules": sos_rules,
            })
        except Exception as exc:
            logger.warning(f"[SOS] socket emit failed: {exc}")

    # Build response with alert and relationships
    response = alert.to_dict()
    response["relationships"] = relationships
    
    return response
