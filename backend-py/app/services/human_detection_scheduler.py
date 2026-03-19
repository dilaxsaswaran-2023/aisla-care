import uuid
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.human_detection_log import HumanDetectionLog

logger = logging.getLogger("human_detection.scheduler")
scheduler = BackgroundScheduler()


def get_demo_human_detection(patient: User) -> bool:
    current_minute = datetime.utcnow().minute
    return current_minute % 3 == 0


def run_human_detection_check_for_all_patients():
    db = SessionLocal()
    try:
        patients = db.query(User).filter(User.role == "patient").all()

        for patient in patients:
            detected = get_demo_human_detection(patient)

            row = HumanDetectionLog(
                patient_id=patient.id,
                event_id=str(uuid.uuid4()),
                human_detected=detected,
                detected_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            db.add(row)

            logger.info(
                f"[HUMAN_DETECTION] patient={patient.id} detected={detected} event_id={row.event_id}"
            )

        db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"[HUMAN_DETECTION] Error: {e}")

    finally:
        db.close()


def start_human_detection_scheduler():
    """Initialize and start the human detection scheduler."""
    job = scheduler.get_job("human_detection_check")
    if job:
        logger.info("[HUMAN_DETECTION] Job already exists")
        return

    scheduler.add_job(
        run_human_detection_check_for_all_patients,
        "interval",
        minutes=2,
        id="human_detection_check",
        name="Human Detection Check Every 2 Minutes",
        replace_existing=True,
    )

    if not scheduler.running:
        scheduler.start()

    logger.info("[HUMAN_DETECTION] Started - runs every 120 seconds")