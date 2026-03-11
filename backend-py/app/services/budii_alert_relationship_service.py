"""Budii Alert Relationship Service - Get and save budii alert relationships"""
import uuid
from sqlalchemy.orm import Session

from app.models.budii_alert_relationship import BudiiAlertRelationship
from app.models.relationship import Relationship


def create_budii_alert_relationships(
    db: Session,
    patient_alert_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    """
    Create budii alert relationship records for all caregivers and family members
    associated with the patient.
    
    Args:
        db: Database session
        patient_alert_id: ID of the patient alert
        patient_id: ID of the patient (alert creator)
    
    Returns:
        List of created BudiiAlertRelationship records as dicts
    """
    print(f"[BUDII_REL] create_budii_alert_relationships called: patient_alert_id={patient_alert_id}, patient_id={patient_id}")
    
    # Get all relationships for this patient
    relationships = db.query(Relationship).filter(
        Relationship.patient_id == patient_id
    ).all()
    
    print(f"[BUDII_REL] Found {len(relationships)} relationships for patient_id={patient_id}")
    
    created_relationships = []
    
    for rel in relationships:
        print(f"[BUDII_REL] Processing relationship: type={rel.relationship_type}, related_user_id={rel.related_user_id}")
        # Determine which field to use (caregiver_id or family_id)
        is_caregiver = rel.relationship_type == "caregiver"
        
        budii_alert_rel = BudiiAlertRelationship(
            patient_alert_id=patient_alert_id,
            caregiver_id=rel.related_user_id if is_caregiver else None,
            family_id=rel.related_user_id if not is_caregiver else None,
        )
        print(f"[BUDII_REL] Adding relationship: caregiver_id={budii_alert_rel.caregiver_id}, family_id={budii_alert_rel.family_id}")
        db.add(budii_alert_rel)
        created_relationships.append(budii_alert_rel)
    
    print(f"[BUDII_REL] Created {len(created_relationships)} relationship records")
    # Note: Caller (service.py) will handle db.commit()
    return [rel.to_dict() for rel in created_relationships]


def get_budii_alert_relationships(
    db: Session,
    patient_alert_id: uuid.UUID,
) -> list[dict]:
    """
    Get all relationships for a specific patient alert.
    
    Args:
        db: Database session
        patient_alert_id: ID of the patient alert
    
    Returns:
        List of BudiiAlertRelationship records as dicts
    """
    relationships = db.query(BudiiAlertRelationship).filter(
        BudiiAlertRelationship.patient_alert_id == patient_alert_id
    ).all()
    
    return [rel.to_dict() for rel in relationships]
