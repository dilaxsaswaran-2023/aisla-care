import logging
import uuid
from datetime import datetime, timezone, timedelta
from math import radians, sin, cos, sqrt, atan2

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.patient_location import PatientCurrentLocation
from app.services.monitor.schemas import MonitorEvent
from app.utils.geofence import is_point_in_polygon

logger = logging.getLogger("monitor.geofence")

GEOFENCE_COOLDOWN_MINUTES = 10


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def to_utc_aware(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def check_geofence(event: MonitorEvent, db: Session) -> list:
    """
    Location is taken from event.lat/lng if present, otherwise falls back to
    the patient_current_location table. A 10-minute cooldown prevents repeated
    alerts for the same breach.
    """
    patient_id = event.patient_id
    logger.info(f"[GEOFENCE] evaluating event={event.event_id} patient={patient_id}")

    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        logger.warning(f"[GEOFENCE] invalid patient_id={patient_id}")
        return []

    user = db.query(User).filter(User.id == patient_uuid).first()
    if user is None:
        logger.info(f"[GEOFENCE] patient {patient_id} not found")
        return []

    if not user.is_geofencing or not user.location_boundary:
        logger.info(f"[GEOFENCE] geofencing not configured for patient={patient_id}")
        return []

    boundary = user.location_boundary
    polygon_points = boundary.get("points") if isinstance(boundary, dict) else None
    has_polygon = isinstance(polygon_points, list) and len(polygon_points) >= 3

    fence = None
    if not has_polygon:
        if (
            boundary.get("latitude") is None
            or boundary.get("longitude") is None
            or user.boundary_radius is None
        ):
            logger.info(f"[GEOFENCE] invalid circular config for patient={patient_id}")
            return []

        fence = {
            "home_lat": boundary["latitude"],
            "home_lng": boundary["longitude"],
            "radius_meters": user.boundary_radius,
        }

    if event.lat is not None and event.lng is not None:
        current_lat, current_lng = event.lat, event.lng
        captured_at = event.timestamp
    else:
        loc_row = (
            db.query(PatientCurrentLocation)
            .filter(PatientCurrentLocation.patient_id == patient_uuid)
            .first()
        )
        if loc_row is None:
            logger.info(f"[GEOFENCE] no location data for patient={patient_id}")
            return []
        current_lat = loc_row.lat
        current_lng = loc_row.lng
        captured_at = loc_row.captured_at.isoformat() if loc_row.captured_at else None

    if has_polygon:
        inside = is_point_in_polygon(current_lat, current_lng, polygon_points)
        logger.info(
            f"[GEOFENCE] patient={patient_id} boundary=polygon points={len(polygon_points)} inside={inside}"
        )
        if inside:
            logger.info(f"[GEOFENCE] inside polygon patient={patient_id}")
            return []
        distance = None
    else:
        distance = haversine_meters(
            current_lat,
            current_lng,
            fence["home_lat"],
            fence["home_lng"],
        )
        logger.info(
            f"[GEOFENCE] patient={patient_id} distance={distance:.2f}m "
            f"radius={fence['radius_meters']}m"
        )

        if distance <= fence["radius_meters"]:
            logger.info(f"[GEOFENCE] inside boundary patient={patient_id}")
            return []

    now = datetime.now(timezone.utc)
    if user.geofence_last_alert is not None:
        last_alert = to_utc_aware(user.geofence_last_alert)

        if (now - last_alert) < timedelta(minutes=GEOFENCE_COOLDOWN_MINUTES):
            logger.info(
                f"[GEOFENCE] cooldown active for patient={patient_id} "
                f"last_alert={user.geofence_last_alert}"
            )
            return []

    user.geofence_last_alert = now
    db.commit()

    logger.warning(f"[GEOFENCE] breach detected patient={patient_id}")
    return [{
        "triggered": True,
        "case": "GEOFENCE_BREACH",
        "action": "SEND_GEOFENCE_ALERT",
        "reason": "Patient outside home boundary",
        "context": {
            "stay_home": False,
            "distance_meters": round(distance, 2) if distance is not None else None,
            "boundary_type": "polygon" if has_polygon else "circle",
            "captured_at": captured_at,
        },
    }]