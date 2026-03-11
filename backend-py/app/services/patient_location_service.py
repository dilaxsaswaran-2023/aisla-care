"""Service for managing patient location data."""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid

from app.models.patient_location import PatientCurrentLocation, PatientLocationRecent


def update_patient_location(
    db: Session,
    patient_id: str,
    lat: float,
    lng: float,
    accuracy: float = None,
    captured_at: datetime = None,
) -> None:
    """
    Update patient's current location and add to recent history.
    
    Automatically prunes recent history to keep only last 10 records.
    """
    if captured_at is None:
        captured_at = datetime.utcnow()
    
    patient_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id

    # Update current location
    current = db.query(PatientCurrentLocation).filter(
        PatientCurrentLocation.patient_id == patient_uuid
    ).first()

    if current:
        current.lat = lat
        current.lng = lng
        current.accuracy = accuracy
        current.captured_at = captured_at
        current.updated_at = datetime.utcnow()
    else:
        current = PatientCurrentLocation(
            patient_id=patient_uuid,
            lat=lat,
            lng=lng,
            accuracy=accuracy,
            captured_at=captured_at,
            updated_at=datetime.utcnow(),
        )
        db.add(current)

    # Add to recent history
    recent = PatientLocationRecent(
        patient_id=patient_uuid,
        lat=lat,
        lng=lng,
        accuracy=accuracy,
        captured_at=captured_at,
    )
    db.add(recent)

    db.commit()

    # Prune recent history to keep only 10 most recent records
    excess_records = db.query(PatientLocationRecent).filter(
        PatientLocationRecent.patient_id == patient_uuid
    ).order_by(desc(PatientLocationRecent.captured_at)).offset(10).all()

    for record in excess_records:
        db.delete(record)

    db.commit()


def get_patient_current_location(db: Session, patient_id: str) -> dict:
    """Get the current location for a patient."""
    patient_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id

    location = db.query(PatientCurrentLocation).filter(
        PatientCurrentLocation.patient_id == patient_uuid
    ).first()

    return location.to_dict() if location else None


def get_patient_recent_locations(db: Session, patient_id: str, limit: int = 10) -> list:
    """Get the recent locations (last N records) for a patient."""
    patient_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id

    locations = db.query(PatientLocationRecent).filter(
        PatientLocationRecent.patient_id == patient_uuid
    ).order_by(desc(PatientLocationRecent.captured_at)).limit(limit).all()

    return [loc.to_dict() for loc in locations]
