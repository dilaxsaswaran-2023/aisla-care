import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.gps_location import GpsLocation
from app.auth import get_current_user
from app.services.patient_location_service import (
    update_patient_location,
    get_patient_current_location,
    get_patient_recent_locations,
)

router = APIRouter(prefix="/api/gps", tags=["gps"])


# POST /api/gps
@router.post("/", status_code=201)
def create_gps(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    location = GpsLocation(
        user_id=uuid.UUID(current_user["userId"]),
        latitude=body["latitude"],
        longitude=body["longitude"],
        accuracy=body.get("accuracy", 0),
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location.to_dict()


# GET /api/gps/latest
@router.get("/latest")
def latest_gps(
    userId: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_id = uuid.UUID(userId) if userId else uuid.UUID(current_user["userId"])
    location = (
        db.query(GpsLocation)
        .filter(GpsLocation.user_id == target_id)
        .order_by(GpsLocation.created_at.desc())
        .first()
    )
    return location.to_dict() if location else None


# ─── Patient Location Endpoints ───────────────────────────────────────────────

# POST /api/gps/patient/location — save patient location to current + recent
@router.post("/patient/location", status_code=201)
def save_patient_location(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save a patient's location.
    Updates:
    - patient_current_location (current position)
    - patient_location_recent (add to history, keep last 10)
    """
    patient_id = body.get("patient_id") or current_user["userId"]
    lat = body.get("latitude") or body.get("lat")
    lng = body.get("longitude") or body.get("lng")
    accuracy = body.get("accuracy")
    captured_at = body.get("captured_at")

    if captured_at and isinstance(captured_at, str):
        captured_at = datetime.fromisoformat(captured_at)

    update_patient_location(
        db,
        patient_id,
        lat,
        lng,
        accuracy=accuracy,
        captured_at=captured_at,
    )

    return {
        "success": True,
        "patient_id": patient_id,
        "lat": lat,
        "lng": lng,
        "accuracy": accuracy,
    }


# GET /api/gps/patient/{patient_id}/current — get patient's current location
@router.get("/patient/{patient_id}/current")
def get_current_location(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current location for a specific patient."""
    location = get_patient_current_location(db, patient_id)
    return location if location else {"error": "No location found"}


# GET /api/gps/patient/{patient_id}/recent — get patient's recent location history
@router.get("/patient/{patient_id}/recent")
def get_recent_locations(
    patient_id: str,
    limit: int = Query(10, le=20),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the recent location history for a specific patient (last 10 by default)."""
    locations = get_patient_recent_locations(db, patient_id, limit=limit)
    return {
        "patient_id": patient_id,
        "count": len(locations),
        "locations": locations,
    }
