import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.alert import Alert
from app.models.alert_relationship import AlertRelationship
from app.models.gps_location import GpsLocation
from app.models.user import User
from app.auth import get_current_user
from app.services.alert_relationship_service import create_alert_relationships
from app.models.budii_alert import PatientAlert
from app.models.sos_alert import SosAlert
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.firebase_helper import push_patient_alert
from app.services.sos_priority_service import get_sos_priority
from app.services.twilio_notifications import notify_patient_alert_created
from app.services.audit_log_service import log_audit_event, build_field_changes

logger = logging.getLogger("alerts.router")
router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ── SOS Check Helper ─────────────────────────────────────────────────────────
def check_sos_direct(alert: Alert, db: Session, patient_id: uuid.UUID) -> list:
    """
    Check if the SOS is a repeat within 8 minutes or a new trigger.
    Returns a rule dict if SOS is detected, empty list otherwise.
    """
    if alert.alert_type != "sos":
        return []
    
    current_time = alert.created_at
    if current_time.tzinfo is not None:
        current_time = current_time.astimezone(timezone.utc).replace(tzinfo=None)
    
    # Get the most recent previous SOS alert, excluding the current one
    last_sos = (
        db.query(Alert)
        .filter(
            Alert.patient_id == patient_id,
            Alert.alert_type == "sos",
            Alert.id != alert.id,
        )
        .order_by(desc(Alert.created_at))
        .first()
    )
    
    if not last_sos:
        logger.info(f"[SOS] No previous SOS for patient {patient_id} - SOS_TRIGGER")
        return [{
            "triggered": True,
            "case": "SOS_TRIGGER",
            "action": "SEND_CONFIRMATION",
            "reason": "SOS triggered",        
            "voice_transcription": alert.voice_transcription,
        }]
    
    last_time = last_sos.created_at
    if last_time.tzinfo is not None:
        last_time = last_time.astimezone(timezone.utc).replace(tzinfo=None)
    
    diff = int((current_time - last_time).total_seconds())
    logger.info(f"[SOS] Seconds since last SOS: {diff}")
    
    if diff <= 480:  # 8 minutes
        logger.warning(f"[SOS] SOS_REPEAT detected for patient {patient_id} within 8 minutes")
        return [{
            "triggered": True,
            "case": "SOS_REPEAT",
            "action": "START_EMERGENCY",
            "reason": "Repeated SOS within 8 minutes",
            "voice_transcription": alert.voice_transcription,
        }]
    
    logger.info(f"[SOS] SOS_TRIGGER for patient {patient_id} - more than 8 minutes since last")
    return [{
        "triggered": True,
        "case": "SOS_TRIGGER",
        "action": "SEND_CONFIRMATION",
        "reason": "SOS triggered",
        "voice_transcription": alert.voice_transcription,
    }]


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

    alert_ids = list({rel.alert_id for rel in relationships})

    if not alert_ids:
        return []

    alerts = (
        db.query(Alert)
        .filter(Alert.id.in_(alert_ids), Alert.is_added_to_emergency != True)
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


# GET /api/alerts/:id
@router.get("/{alert_id}")
def get_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    alert = db.query(Alert).filter(Alert.id == aid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    data = alert.to_dict()
    patient = db.query(User).filter(User.id == alert.patient_id).first()
    data["patient_name"] = patient.full_name if patient else "Unknown"
    return data


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

    log_audit_event(
        db,
        action="alert_created",
        event_type="alerts",
        entity_type="alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Alert created",
        details="A new patient alert was created.",
        context={
            "alert_type": alert.alert_type,
            "priority": alert.priority,
            "status": alert.status,
            "title": alert.title,
        },
    )

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

    before = {
        "status": alert.status,
        "priority": alert.priority,
        "title": alert.title,
        "message": alert.message,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
    }

    for key in ["status", "priority", "title", "message", "latitude", "longitude"]:
        if key in body:
            setattr(alert, key, body[key])

    db.commit()
    db.refresh(alert)

    after = {
        "status": alert.status,
        "priority": alert.priority,
        "title": alert.title,
        "message": alert.message,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
    }
    changes = build_field_changes(before, after, ["status", "priority", "title", "message", "latitude", "longitude"])

    log_audit_event(
        db,
        action="alert_updated",
        event_type="alerts",
        entity_type="alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Alert updated",
        details="Alert fields were updated.",
        context={
            "alert_type": alert.alert_type,
            "status": alert.status,
            "priority": alert.priority,
        },
        changes=changes,
    )

    return alert.to_dict()


# PATCH /api/alerts/mark-read/{alert_id}
@router.patch("/mark-read/{alert_id}")
def mark_alert_read(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a single alert as read.
    """
    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    
    alert = db.query(Alert).filter(Alert.id == aid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_read = True
    db.add(alert)
    db.commit()

    log_audit_event(
        db,
        action="alert_marked_read",
        event_type="alerts",
        entity_type="alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Alert marked as read",
        details="A single alert was marked as read.",
        context={"alert_type": alert.alert_type},
    )

    return {"success": True}


# PATCH /api/alerts/mark-read-all
@router.patch("/mark-read-all")
def mark_all_alerts_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all alerts linked to the current user as read.
    """
    user_id = uuid.UUID(current_user["userId"])
    rel_ids = [
        r.alert_id for r in
        db.query(AlertRelationship).filter(
            (AlertRelationship.caregiver_id == user_id) |
            (AlertRelationship.family_id == user_id)
        ).all()
    ]
    if rel_ids:
        db.query(Alert).filter(Alert.id.in_(rel_ids), Alert.is_read == False).update(
            {"is_read": True}, synchronize_session="fetch"
        )
    db.commit()

    log_audit_event(
        db,
        action="alerts_marked_read_all",
        event_type="alerts",
        entity_type="alert",
        current_user=current_user,
        summary="All visible alerts marked as read",
        details="All unread alerts linked to the actor were marked as read.",
        context={"count": len(rel_ids)},
    )

    return {"success": True}


# POST /api/alerts/sos
@router.post("/sos", status_code=201)
async def sos_alert(
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

    log_audit_event(
        db,
        action="sos_triggered",
        event_type="alerts",
        entity_type="alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=user_id,
        summary="SOS alert triggered",
        details="Patient triggered SOS and an emergency alert was created.",
        context={
            "priority": alert.priority,
            "latitude": alert.latitude,
            "longitude": alert.longitude,
            "voice_transcription": bool(body.voice_transcription),
        },
        severity="critical",
    )

    # Create alert relationships for all caregivers and family members
    relationships = create_alert_relationships(db, alert.id, user_id)

    # Run SOS check to determine if it's SOS_TRIGGER or SOS_REPEAT
    sos_rules = check_sos_direct(alert, db, user_id)

    # If SOS_REPEAT → create PatientAlert, mark alert as emergency, push to Firebase
    sos_case = sos_rules[0]["case"] if sos_rules else None
    if sos_case == "SOS_TRIGGER" or sos_case == "SOS_REPEAT":
        sos_alert = SosAlert(
            patient_id=user_id,
            event_id=str(alert.id), 
            alert_type="sos",   
            message=sos_rules[0].get("voice_transcription", ""), 
            priority=(
                get_sos_priority(body.voice_transcription or "")
                if sos_case == "SOS_TRIGGER"
                else "high"
            ) or "high",
        )            
        db.add(sos_alert)
        db.commit()
        db.refresh(sos_alert)

        log_audit_event(
            db,
            action="sos_recorded",
            event_type="alerts",
            entity_type="sos_alert",
            entity_id=str(sos_alert.id),
            current_user=current_user,
            patient_id=user_id,
            summary="SOS emergency record created",
            details="An SOS event was persisted for emergency workflow.",
            context={
                "sos_case": sos_case,
                "priority": sos_alert.priority,
            },
            severity="critical",
        )

    if sos_case == "SOS_REPEAT":
        alert.is_added_to_emergency = True
        db.add(alert)

        patient_alert = PatientAlert(
            patient_id=user_id,
            event_id=str(alert.id),
            alert_type="SOS_REPEAT",
            title="SOS Emergency - Patient in Critical State",
        )
        db.add(patient_alert)
        db.flush()
        create_budii_alert_relationships(db, patient_alert.id, user_id)
        db.commit()
        db.refresh(patient_alert)

        log_audit_event(
            db,
            action="sos_escalated",
            event_type="alerts",
            entity_type="patient_alert",
            entity_id=str(patient_alert.id),
            current_user=current_user,
            patient_id=user_id,
            summary="SOS escalated to emergency workflow",
            details="Repeated SOS promoted to emergency queue and notifications were sent.",
            context={
                "sos_case": sos_case,
                "source_alert_id": str(alert.id),
            },
            severity="critical",
        )

        # Push to Firebase
        pa_dict = patient_alert.to_dict()
        patient_user = db.query(User).filter(User.id == user_id).first()
        pa_dict["patient_name"] = patient_user.full_name if patient_user else "Unknown"
        push_patient_alert(pa_dict)

        try:
            notify_patient_alert_created(db, patient_alert)
        except Exception as exc:
            logger.warning(f"[SOS] Twilio notification failed for patient_alert={patient_alert.id}: {exc}")

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
    response["sos_result"] = sos_rules[0] if sos_rules else None
    
    return response
