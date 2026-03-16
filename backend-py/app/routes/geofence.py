"""Geofencing alerts and monitoring routes."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.alert import Alert
from app.utils.geofence import haversine_distance, evaluate_geofence_state, is_point_in_polygon


router = APIRouter(prefix="/api/geofence", tags=["geofence"])


class SetGeofenceRequest:
    """Request to set geofence for a patient."""
    pass


# ── POST /api/geofence/setup ────────────────────────────────────────────────
@router.post("/setup", status_code=200)
def setup_geofence(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Setup or update geofence for a patient.
    
    Body:
    {
        "patient_id": "uuid",
        "is_geofencing": true,
        "location_boundary": {
            "latitude": 40.7128,
            "longitude": -74.0060
        },
        "boundary_radius": 500  # in meters
    }
    """
    patient_id = body.get("patient_id")
    is_geofencing = body.get("is_geofencing", True)
    location_boundary = body.get("location_boundary")
    boundary_radius = body.get("boundary_radius")

    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")

    # Verify caregiver has access to this patient
    current_user_id = uuid.UUID(current_user["userId"])
    patient = db.query(User).filter(User.id == uuid.UUID(patient_id)).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if patient.role != "patient":
        raise HTTPException(status_code=400, detail="User must be a patient")
    
    # Check permission: caregiver should be assigned to this patient
    if current_user["role"] == "caregiver" and patient.caregiver_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to set geofence for this patient")

    # Update patient geofence settings
    patient.is_geofencing = is_geofencing
    if is_geofencing:
        if not location_boundary:
            raise HTTPException(status_code=400, detail="location_boundary is required when enabling geofencing")

        polygon_points = location_boundary.get("points") if isinstance(location_boundary, dict) else None
        has_polygon = isinstance(polygon_points, list) and len(polygon_points) >= 3
        has_circle = (
            isinstance(location_boundary, dict)
            and location_boundary.get("latitude") is not None
            and location_boundary.get("longitude") is not None
            and boundary_radius is not None
        )

        if not has_polygon and not has_circle:
            raise HTTPException(
                status_code=400,
                detail="Provide polygon points (>=3) or latitude/longitude with boundary_radius",
            )

        if has_polygon:
            patient.location_boundary = {
                "type": "polygon",
                "points": polygon_points,
            }
            patient.boundary_radius = None
        else:
            patient.location_boundary = {
                "latitude": location_boundary.get("latitude"),
                "longitude": location_boundary.get("longitude"),
            }
            patient.boundary_radius = boundary_radius

        patient.geofence_state = "inside"
        patient.geofence_outside_count = 0
    
    db.commit()
    db.refresh(patient)
    
    return {
        "message": f"Geofence {'enabled' if is_geofencing else 'disabled'} for patient",
        "patient": patient.to_dict(),
    }


# ── POST /api/geofence/check-location ───────────────────────────────────────
@router.post("/check-location", status_code=200)
def check_location(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Patient sends their current location for geofence check.
    
    Body:
    {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "accuracy": 10
    }
    """
    patient_id = current_user["userId"]
    latitude = body.get("latitude")
    longitude = body.get("longitude")
    accuracy = body.get("accuracy", 10)  # GPS accuracy in meters
    
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="latitude and longitude required")
    
    patient = db.query(User).filter(User.id == uuid.UUID(patient_id)).first()
    
    if not patient or patient.role != "patient":
        raise HTTPException(status_code=400, detail="Only patients can send location")
    
    if not patient.is_geofencing or not patient.location_boundary:
        # Geofencing not enabled
        return {"status": "geofencing_disabled", "alert_sent": False}

    boundary = patient.location_boundary
    polygon_points = boundary.get("points") if isinstance(boundary, dict) else None
    has_polygon = isinstance(polygon_points, list) and len(polygon_points) >= 3

    if has_polygon:
        inside = is_point_in_polygon(latitude, longitude, polygon_points)

        if inside:
            should_re_enter = patient.geofence_state == "outside_confirmed"
            new_state, count, should_alert = "inside", 0, False
        else:
            count = (patient.geofence_outside_count or 0) + 1
            should_alert = count >= 3 and patient.geofence_state != "outside_confirmed"
            new_state = "outside_confirmed" if count >= 3 else "outside_candidate"
            should_re_enter = False

        distance = None
    else:
        if boundary.get("latitude") is None or boundary.get("longitude") is None or patient.boundary_radius is None:
            return {"status": "geofencing_disabled", "alert_sent": False}

        boundary_lat = boundary["latitude"]
        boundary_lon = boundary["longitude"]

        new_state, count, should_alert, should_re_enter = evaluate_geofence_state(
            current_lat=latitude,
            current_lon=longitude,
            boundary_lat=boundary_lat,
            boundary_lon=boundary_lon,
            boundary_radius_meters=patient.boundary_radius,
            accuracy_meters=accuracy,
            previous_state=patient.geofence_state,
            outside_sample_count=patient.geofence_outside_count,
        )
        distance = haversine_distance(latitude, longitude, boundary_lat, boundary_lon)
    
    # Update patient geofence tracking
    patient.geofence_state = new_state
    patient.geofence_outside_count = count
    
    alert_sent = False
    alert_type = None
    
    # Check deduplication: don't send alerts more than once every 5 minutes
    last_alert = patient.geofence_last_alert
    can_alert = last_alert is None or (datetime.utcnow() - last_alert).total_seconds() > 300
    
    # Send exit alert
    if should_alert and can_alert:
        alert = Alert(
            patient_id=uuid.UUID(patient_id),
            type="geofence_exit",
            title="Patient Left Safe Zone",
            message=f"Patient has exited the safe zone boundary",
            severity="high",
            is_read=False,
        )
        db.add(alert)
        patient.geofence_last_alert = datetime.utcnow()
        alert_sent = True
        alert_type = "exit"
    
    # Send re-entry notification
    if should_re_enter and can_alert:
        alert = Alert(
            patient_id=uuid.UUID(patient_id),
            type="geofence_reentry",
            title="Patient Returned to Safe Zone",
            message=f"Patient has returned to the safe zone",
            severity="info",
            is_read=False,
        )
        db.add(alert)
        patient.geofence_last_alert = datetime.utcnow()
        alert_sent = True
        alert_type = "reentry"
    
    db.commit()
    
    return {
        "status": new_state,
        "distance_meters": round(distance, 2) if distance is not None else None,
        "boundary_radius_meters": patient.boundary_radius,
        "boundary_type": "polygon" if has_polygon else "circle",
        "alert_sent": alert_sent,
        "alert_type": alert_type,
    }


# ── GET /api/geofence/status ────────────────────────────────────────────────
@router.get("/status/{patient_id}")
def get_geofence_status(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get geofence status for a patient."""
    patient = db.query(User).filter(User.id == uuid.UUID(patient_id)).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Permission check
    current_user_id = uuid.UUID(current_user["userId"])
    if current_user["role"] == "caregiver" and patient.caregiver_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "patient_id": patient_id,
        "is_geofencing": patient.is_geofencing,
        "location_boundary": patient.location_boundary,
        "boundary_radius": patient.boundary_radius,
        "geofence_state": patient.geofence_state,
        "is_within_boundary": patient.geofence_state == "inside",
    }
