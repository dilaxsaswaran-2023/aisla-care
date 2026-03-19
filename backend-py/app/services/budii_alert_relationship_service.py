"""Budii Alert Relationship Service - Get and save budii alert relationships"""
import uuid
from sqlalchemy.orm import Session

from app.models.patient_alert_relationship import BudiiAlertRelationship
from app.models.relationship import Relationship


def create_budii_alert_relationships(
    db: Session,
    patient_alert_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    """
    Create budii alert relationship records for all caregivers and family members
    associated with the patient.

    The function now combines caregiver and family into the same row whenever
    possible (index-based pairing), instead of always creating separate rows for
    each role.
    
    Args:
        db: Database session
        patient_alert_id: ID of the patient alert
        patient_id: ID of the patient (alert creator)
    
    Returns:
        List of created BudiiAlertRelationship records as dicts
    """
    existing_rows = (
        db.query(BudiiAlertRelationship)
        .filter(BudiiAlertRelationship.patient_alert_id == patient_alert_id)
        .all()
    )
    if existing_rows:
        return [rel.to_dict() for rel in existing_rows]

    relationships = db.query(Relationship).filter(
        Relationship.patient_id == patient_id
    ).all()

    caregiver_ids = [
        rel.related_user_id
        for rel in relationships
        if rel.relationship_type == "caregiver"
    ]
    family_ids = [
        rel.related_user_id
        for rel in relationships
        if rel.relationship_type == "family"
    ]

    created_relationships: list[BudiiAlertRelationship] = []
    row_count = max(len(caregiver_ids), len(family_ids))
    for index in range(row_count):
        budii_alert_rel = BudiiAlertRelationship(
            patient_alert_id=patient_alert_id,
            caregiver_id=caregiver_ids[index] if index < len(caregiver_ids) else None,
            family_id=family_ids[index] if index < len(family_ids) else None,
        )
        db.add(budii_alert_rel)
        created_relationships.append(budii_alert_rel)

    # Note: Caller will handle db.commit()
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
