import logging
from database.queries import (
    get_geofence,
    get_medication_schedule,
    get_active_hours,
)

logger = logging.getLogger("budii.graph.config")


def load_patient_config(state):
    patient_id = state["patient_id"]

    logger.info(f"[CONFIG] loading config for patient={patient_id}")
    logger.info(f"[CONFIG] geofence={get_geofence(patient_id)}")
    logger.info(f"[CONFIG] medication_schedule={get_medication_schedule(patient_id)}")
    logger.info(f"[CONFIG] active_hours={get_active_hours(patient_id)}")
    return {
        "geofence": get_geofence(patient_id),
        "medication_schedule": get_medication_schedule(patient_id),
        "active_hours": get_active_hours(patient_id),
    }