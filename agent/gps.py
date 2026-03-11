import time
import uuid
import logging
import sys
import requests
from pathlib import Path

# Ensure the backend app package is importable when running this script directly.
# This script lives in `agent/`, but the `app` package is in `backend-py/app`.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend-py"))

from app.database import SessionLocal
from app.models.user import User


def get_session():
    """Return a SQLAlchemy session (mimics backend dependency)."""
    return SessionLocal()


logger = logging.getLogger("budii.geofence.scheduler")

BUDII_MAIN_EVENTS_URL = "http://127.0.0.1:8000/events"


def get_all_geofencing_patient_ids():
    session = get_session()
    try:
        rows = (
            session.query(User.id)
            .filter(
                User.is_geofencing == True,
                User.location_boundary.isnot(None),
                User.boundary_radius.isnot(None),
            )
            .all()
        )
        return [str(row[0]) for row in rows]
    finally:
        session.close()


def send_geofence_event_to_main(patient_id: str):
    payload = {
        "event_id": f"geo_{uuid.uuid4().hex[:12]}",
        "patient_id": patient_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "lat": 0.0,
        "lng": 0.0,
    }

    logger.info(f"[GEOFENCE] posting payload={payload}")

    response = requests.post(BUDII_MAIN_EVENTS_URL, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def monitor_and_send_to_main_every_minute():
    while True:
        try:
            patient_ids = get_all_geofencing_patient_ids()
            logger.info(f"[GEOFENCE] found {len(patient_ids)} geofencing patients")

            for patient_id in patient_ids:
                try:
                    result = send_geofence_event_to_main(patient_id)
                    logger.info(f"[GEOFENCE] sent to main for patient={patient_id} result={result}")
                except Exception as e:
                    logger.exception(f"[GEOFENCE] failed for patient={patient_id}: {e}")

        except Exception as e:
            logger.exception(f"[GEOFENCE] scheduler error: {e}")

        time.sleep(60)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    logger.info("[GEOFENCE] scheduler started")
    monitor_and_send_to_main_every_minute()