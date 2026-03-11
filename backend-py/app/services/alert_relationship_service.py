"""Alert Relationship Service - Get and save alert relationships"""
import uuid
from sqlalchemy.orm import Session

from app.models.alert_relationship import AlertRelationship
from app.models.relationship import Relationship


def create_alert_relationships(
    db: Session,
    alert_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    """
    Create alert relationship records for all caregivers and family members
    associated with the patient.
    
    Args:
        db: Database session
        alert_id: ID of the alert
        patient_id: ID of the patient (alert creator)
    
    Returns:
        List of created AlertRelationship records as dicts
    """
    # Get all relationships for this patient
    relationships = db.query(Relationship).filter(
        Relationship.patient_id == patient_id
    ).all()
    
    created_relationships = []
    
    for rel in relationships:
        # Determine which field to use (caregiver_id or family_id)
        is_caregiver = rel.relationship_type == "caregiver"
        
        alert_rel = AlertRelationship(
            alert_id=alert_id,
            caregiver_id=rel.related_user_id if is_caregiver else None,
            family_id=rel.related_user_id if not is_caregiver else None,
        )
        db.add(alert_rel)
        created_relationships.append(alert_rel)
    
    if created_relationships:
        db.commit()
        # Refresh all to get timestamps
        for rel in created_relationships:
            db.refresh(rel)
    
    return [rel.to_dict() for rel in created_relationships]


def get_alert_relationships(
    db: Session,
    alert_id: uuid.UUID,
) -> list[dict]:
    """
    Get all relationships for a specific alert.
    
    Args:
        db: Database session
        alert_id: ID of the alert
    
    Returns:
        List of AlertRelationship records as dicts
    """
    relationships = db.query(AlertRelationship).filter(
        AlertRelationship.alert_id == alert_id
    ).all()
    
    return [rel.to_dict() for rel in relationships]
