import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.user import User
from app.models.human_detection_log import HumanDetectionLog
from app.models.patient_activity_schedule import PatientActivitySchedule
from app.models.patient_inactivity_log import PatientInactivityLog

logger = logging.getLogger("inactivity.scheduler")
scheduler = BackgroundScheduler()


def run_inactivity_check_for_all_patients():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        current_time = now.time()

        patients = db.query(User).filter(User.role == "patient").all()

        for patient in patients:
            active_schedules = (
                db.query(PatientActivitySchedule)
                .filter(PatientActivitySchedule.patient_id == patient.id)
                .all()
            )

            for schedule in active_schedules:
                if schedule.start_time <= current_time <= schedule.end_time:
                    latest_detection = (
                        db.query(HumanDetectionLog)
                        .filter(HumanDetectionLog.patient_id == patient.id)
                        .order_by(HumanDetectionLog.detected_at.desc())
                        .first()
                    )

                    if not latest_detection:
                        continue

                    if latest_detection.human_detected is False:
                        existing = (
                            db.query(PatientInactivityLog)
                            .filter(
                                PatientInactivityLog.patient_id == patient.id,
                                PatientInactivityLog.inactivity_type == schedule.activity_name,
                            )
                            .order_by(PatientInactivityLog.inactivity_time.desc())
                            .first()
                        )

                        if existing and existing.inactivity_time.date() == now.date():
                            logger.info(
                                f"[INACTIVITY] already logged today patient={patient.id} type={schedule.activity_name}"
                            )
                            continue

                        row = PatientInactivityLog(
                            patient_id=patient.id,
                            inactivity_type=schedule.activity_name,
                            inactivity_time=now,
                        )
                        db.add(row)

                        logger.info(
                            f"[INACTIVITY] patient={patient.id} type={schedule.activity_name} time={now}"
                        )

        db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"[INACTIVITY] Error: {e}")

    finally:
        db.close()


def start_inactivity_scheduler():
    """Register inactivity job."""
    job = scheduler.get_job("inactivity_check")
    if job:
        logger.info("[INACTIVITY] Job already exists")
        return

    scheduler.add_job(
        run_inactivity_check_for_all_patients,
        "interval",
        minutes=2,
        id="inactivity_check",
        name="Inactivity Check Every 2 Minutes",
        replace_existing=True,
    )

    if not scheduler.running:
        scheduler.start()

    logger.info("[INACTIVITY] Started - runs every 120 seconds")