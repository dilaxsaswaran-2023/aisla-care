"""ORM queries used by the Budii LangGraph agent.

All data is read from the shared PostgreSQL database defined in backend-py.

Geofence data   → User.location_boundary  (JSON {latitude, longitude})
                  User.boundary_radius     (float, metres)
                  User.is_geofencing       (bool)
Medication data → MedicationSchedule table
Active hours    → PatientActiveHours table
"""
import logging
import uuid
from typing import Optional

from database.db import get_session  # also sets up sys.path + imports models
from app.models.user import User
from app.models.medication_schedule import MedicationSchedule
from app.models.patient_active_hours import PatientActiveHours

logger = logging.getLogger("budii.queries")


def _to_uuid(patient_id: str):
    """Convert a patient_id string to UUID, returning None if invalid."""
    try:
        return uuid.UUID(patient_id)
    except (ValueError, AttributeError):
        return None


def get_geofence(patient_id: str) -> Optional[dict]:
    """
    Return geofence config for the given patient.

    Reads from the User row: is_geofencing, location_boundary, boundary_radius.
    Returns None if the user does not exist or geofencing is disabled.
    """
    patient_uuid = _to_uuid(patient_id)
    if patient_uuid is None:
        logger.warning(f"[QUERY] get_geofence: invalid UUID '{patient_id}'")
        return None

    session = get_session()
    try:
        user = session.query(User).filter(User.id == patient_uuid).first()
        if user is None:
            logger.warning(f"[QUERY] get_geofence: patient {patient_id} not found")
            return None
        if not user.is_geofencing or not user.location_boundary or user.boundary_radius is None:
            logger.info(f"[QUERY] get_geofence: geofencing not configured for {patient_id}")
            return None

        boundary = user.location_boundary  # {"latitude": float, "longitude": float}
        return {
            "patient_id": patient_id,
            "home_lat": boundary["latitude"],
            "home_lng": boundary["longitude"],
            "radius_meters": user.boundary_radius,
        }
    finally:
        session.close()


def get_medication_schedule(patient_id: str) -> list:
    """Return active medication schedules for the given patient."""
    patient_uuid = _to_uuid(patient_id)
    if patient_uuid is None:
        logger.warning(f"[QUERY] get_medication_schedule: invalid UUID '{patient_id}'")
        return []

    session = get_session()
    try:
        rows = (
            session.query(MedicationSchedule)
            .filter(
                MedicationSchedule.patient_id == patient_uuid,
                MedicationSchedule.is_active.is_(True),
            )
            .order_by(MedicationSchedule.scheduled_time)
            .all()
        )
        return [r.to_dict() for r in rows]
    finally:
        session.close()


def get_active_hours(patient_id: str) -> Optional[dict]:
    """Return active hours config for the given patient."""
    patient_uuid = _to_uuid(patient_id)
    if patient_uuid is None:
        logger.warning(f"[QUERY] get_active_hours: invalid UUID '{patient_id}'")
        return None

    session = get_session()
    try:
        row = (
            session.query(PatientActiveHours)
            .filter(PatientActiveHours.patient_id == patient_uuid)
            .first()
        )
        return row.to_dict() if row else None
    finally:
        session.close()

