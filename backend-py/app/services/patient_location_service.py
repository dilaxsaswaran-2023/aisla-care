"""Service for managing patient location data."""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid
import math

from app.models.patient_location import PatientCurrentLocation, PatientLocationRecent


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on earth (in meters).
    """
    R = 6371000  # Radius of earth in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def is_duplicate_location(
    current_lat: float,
    current_lng: float,
    new_lat: float,
    new_lng: float,
    threshold_meters: float = 5.0,
) -> bool:
    """
    Check if new location is essentially the same as current (within threshold).
    """
    distance = haversine_distance(current_lat, current_lng, new_lat, new_lng)
    return distance < threshold_meters


def update_patient_location(
    db: Session,
    patient_id: str,
    lat: float,
    lng: float,
    accuracy: float = None,
    captured_at: datetime = None,
) -> bool:
    """
    Update patient's current location and add to recent history.
    
    Returns True if location was updated, False if it was a duplicate.
    Automatically prunes recent history to keep only last 10 records.
    """
    if captured_at is None:
        captured_at = datetime.now(timezone.utc)
    
    patient_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id

    print(f"[patient_location_service] update_patient_location called for patient={patient_uuid}, lat={lat}, lng={lng}, accuracy={accuracy}, captured_at={captured_at}")

    # Load current location (if any)
    current = db.query(PatientCurrentLocation).filter(
        PatientCurrentLocation.patient_id == patient_uuid
    ).first()

    # Update current location
    if current:
        current.lat = lat
        current.lng = lng
        current.accuracy = accuracy
        current.captured_at = captured_at
        current.updated_at = datetime.now(timezone.utc)
    else:
        current = PatientCurrentLocation(
            patient_id=patient_uuid,
            lat=lat,
            lng=lng,
            accuracy=accuracy,
            captured_at=captured_at,
            updated_at=datetime.now(timezone.utc),
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
    # Log count after pruning
    count = db.query(PatientLocationRecent).filter(PatientLocationRecent.patient_id == patient_uuid).count()
    print(f"[patient_location_service] finished update for patient={patient_uuid}, recent_count={count}")
    return True


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
