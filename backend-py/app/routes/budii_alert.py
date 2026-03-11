import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.budii_alert import PatientAlert
from app.models.budii_alert_relationship import BudiiAlertRelationship
from app.models.audit_log import AuditLog
from app.models.user import User
from app.auth import get_current_user
from app.services.budii_alert_relationship_service import create_budii_alert_relationships

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
        alert_type=body.alert_type,
        title=body.title,
        message=body.message or "",
        status=body.status,
        source=body.source,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Audit log
    audit = AuditLog(
        user_id=uuid.UUID(current_user["userId"]),
        action="budii_alert_created",
        entity_type="budii_alert",
        entity_id=str(alert.id),
        metadata_={"case": body.case, "alert_type": body.alert_type},
    )
    db.add(audit)
    db.commit()

    # Create alert relationships for all caregivers and family members
    relationships = create_budii_alert_relationships(db, alert.id, patient_id)

    # Build response with alert and relationships
    response = alert.to_dict()
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

    for key in ["status", "message", "title", "case", "alert_type"]:
        if key in body:
            setattr(alert, key, body[key])

    db.commit()
    db.refresh(alert)
    return alert.to_dict()
