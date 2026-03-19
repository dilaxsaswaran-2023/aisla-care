import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient_alert import PatientAlert
from app.models.patient_alert_relationship import BudiiAlertRelationship
from app.models.user import User
from app.auth import get_current_user
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.audit_log_service import log_audit_event, build_field_changes
from app.services.firebase_helper import push_patient_alert

router = APIRouter(prefix="/api/budii-alerts", tags=["budii-alerts"])


# Request models
class BudiiAlertRequest(BaseModel):
    patient_id: str
    alert_type: str
    case: str | None = None
    title: str
    message: str | None = None
    status: str = "active"
    source: str = "budii"


# GET /api/budii-alerts
@router.get("/")
def list_budii_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all patient alerts."""
    alerts = db.query(PatientAlert).order_by(PatientAlert.created_at.desc()).limit(50).all()
    return [a.to_dict() for a in alerts]


# GET /api/budii-alerts/me — returns alerts linked to current user via budii_alert_relationships
@router.get("/me")
def my_budii_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all patient alerts where the logged-in user appears as caregiver_id or family_id
    in the budii_alert_relationships table. Enriches each alert with the patient's name.
    """
    user_id = uuid.UUID(current_user["userId"])

    # Find all patient_alert_ids linked to this user (as caregiver or family)
    relationships = (
        db.query(BudiiAlertRelationship)
        .filter(
            (BudiiAlertRelationship.caregiver_id == user_id) |
            (BudiiAlertRelationship.family_id == user_id)
        )
        .all()
    )

    print(f"Found {len(relationships)} budii alert relationships for user {user_id}")

    alert_ids = list({rel.patient_alert_id for rel in relationships})

    if not alert_ids:
        return []

    alerts = (
        db.query(PatientAlert)
        .filter(PatientAlert.id.in_(alert_ids))
        .order_by(PatientAlert.created_at.desc())
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


# GET /api/budii-alerts/:id
@router.get("/{alert_id}")
def get_budii_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific patient alert."""
    alert = db.query(PatientAlert).filter(PatientAlert.id == uuid.UUID(alert_id)).first()
    if not alert:
        raise HTTPException(404, "Patient alert not found")

    data = alert.to_dict()
    patient = db.query(User).filter(User.id == alert.patient_id).first()
    data["patient_name"] = patient.full_name if patient else "Unknown"
    
    return data


# POST /api/budii-alerts
@router.post("/", status_code=201)
def create_budii_alert(
    body: BudiiAlertRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new patient alert."""
    patient_id = uuid.UUID(body.patient_id)
    
    alert = PatientAlert(
        patient_id=patient_id,
        event_id=str(uuid.uuid4()),
        case=body.case,
        title=body.title,
        alert_type=body.case,
        message=body.message,
        status=body.status,
        source=body.source,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    log_audit_event(
        db,
        action="budii_alert_created",
        event_type="budii_alerts",
        entity_type="patient_alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Budii alert created",
        details="A Budii-generated alert was created for a patient.",
        context={
            "alert_type": alert.alert_type,
            "event_id": alert.event_id,
        },
    )

    # Create alert relationships for all caregivers and family members
    relationships = create_budii_alert_relationships(db, alert.id, patient_id)

    patient = db.query(User).filter(User.id == alert.patient_id).first()
    alert_payload = alert.to_dict()
    alert_payload["patient_name"] = patient.full_name if patient else "Unknown"
    push_patient_alert(alert_payload)

    # Build response with alert and relationships
    response = alert_payload
    response["relationships"] = relationships
    
    return response


# PATCH /api/budii-alerts/:id
@router.patch("/{alert_id}")
def update_budii_alert(
    alert_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a patient alert."""
    alert = db.query(PatientAlert).filter(PatientAlert.id == uuid.UUID(alert_id)).first()
    if not alert:
        raise HTTPException(404, "Patient alert not found")

    before = {
        "status": getattr(alert, "status", None),
        "message": getattr(alert, "message", None),
        "title": getattr(alert, "title", None),
        "case": getattr(alert, "case", None),
        "alert_type": getattr(alert, "alert_type", None),
    }

    for key in ["status", "message", "title", "case", "alert_type"]:
        if key in body:
            setattr(alert, key, body[key])

    db.commit()
    db.refresh(alert)

    after = {
        "status": getattr(alert, "status", None),
        "message": getattr(alert, "message", None),
        "title": getattr(alert, "title", None),
        "case": getattr(alert, "case", None),
        "alert_type": getattr(alert, "alert_type", None),
    }
    changes = build_field_changes(before, after, ["status", "message", "title", "case", "alert_type"])

    log_audit_event(
        db,
        action="budii_alert_updated",
        event_type="budii_alerts",
        entity_type="patient_alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Budii alert updated",
        details="A Budii alert was updated.",
        changes=changes,
    )

    return alert.to_dict()


# PATCH /api/budii-alerts/mark-read/{alert_id}
@router.patch("/mark-read/{alert_id}")
def mark_budii_alert_read(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a single patient alert as read.
    """
    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    
    alert = db.query(PatientAlert).filter(PatientAlert.id == aid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Patient alert not found")
    
    alert.is_read = True
    db.add(alert)
    db.commit()

    log_audit_event(
        db,
        action="budii_alert_marked_read",
        event_type="budii_alerts",
        entity_type="patient_alert",
        entity_id=str(alert.id),
        current_user=current_user,
        patient_id=alert.patient_id,
        summary="Budii alert marked as read",
        details="A single Budii alert was marked as read.",
    )

    return {"success": True}


# PATCH /api/budii-alerts/mark-read-all
@router.patch("/mark-read-all")
def mark_all_budii_alerts_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all patient alerts linked to the current user as read.
    """
    user_id = uuid.UUID(current_user["userId"])
    rel_ids = [
        r.patient_alert_id for r in
        db.query(BudiiAlertRelationship).filter(
            (BudiiAlertRelationship.caregiver_id == user_id) |
            (BudiiAlertRelationship.family_id == user_id)
        ).all()
    ]
    if rel_ids:
        db.query(PatientAlert).filter(PatientAlert.id.in_(rel_ids), PatientAlert.is_read == False).update(
            {"is_read": True}, synchronize_session="fetch"
        )
    db.commit()

    log_audit_event(
        db,
        action="budii_alerts_marked_read_all",
        event_type="budii_alerts",
        entity_type="patient_alert",
        current_user=current_user,
        summary="All Budii alerts marked as read",
        details="All unread Budii alerts linked to the actor were marked as read.",
        context={"count": len(rel_ids)},
    )

    return {"success": True}
