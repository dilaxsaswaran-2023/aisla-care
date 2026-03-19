import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.patient_alert import PatientAlert
from app.models.relationship import Relationship
from app.models.user import User

router = APIRouter(prefix="/api/patient_alert", tags=["patient-alert"])


class PatientAlertAcknowledgeRequest(BaseModel):
    how: str


def _get_accessible_patient_ids(db: Session, current_user: dict) -> list[uuid.UUID]:
    user_id = uuid.UUID(current_user["userId"])
    role = current_user.get("role")

    if role in ["super_admin", "admin"]:
        return [row.id for row in db.query(User.id).filter(User.role == "patient").all()]

    if role == "patient":
        return [user_id]

    relationship_rows = db.query(Relationship.patient_id).filter(
        Relationship.related_user_id == user_id,
        Relationship.patient_id.isnot(None),
    )

    if role == "family":
        relationship_rows = relationship_rows.filter(Relationship.relationship_type == "family")
        return [row.patient_id for row in relationship_rows.all()]

    if role == "caregiver":
        related_patient_ids = [row.patient_id for row in relationship_rows.all()]
        assigned_patient_ids = [
            row.id
            for row in db.query(User.id).filter(
                User.role == "patient",
                User.caregiver_id == user_id,
            ).all()
        ]
        return list(set(related_patient_ids + assigned_patient_ids))

    return []


@router.patch("/{patient_alert_id}/acknowledge")
def acknowledge_patient_alert(
    patient_alert_id: str,
    body: PatientAlertAcknowledgeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        parsed_alert_id = uuid.UUID(patient_alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient_alert ID")

    how = (body.how or "").strip().lower()
    if not how:
        raise HTTPException(status_code=400, detail="Acknowledgement method is required")

    alert = db.query(PatientAlert).filter(PatientAlert.id == parsed_alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Patient alert not found")

    patient_ids = _get_accessible_patient_ids(db, current_user)
    if alert.patient_id not in patient_ids:
        raise HTTPException(status_code=403, detail="You do not have permission to acknowledge this alert")

    alert.is_acknowledged = True
    alert.acknowledged_via = how
    db.add(alert)
    db.commit()

    return {
        "success": True,
        "patient_alert_id": str(alert.id),
        "is_acknowledged": True,
        "acknowledged_via": how,
    }
