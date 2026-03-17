import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.alert import Alert
from app.models.budii_alert import PatientAlert
from app.models.medication_schedule import MedicationSchedule
from app.models.medication_schedule_breach import MedicationScheduleBreach
from app.models.medication_schedule_monitor import MedicationScheduleMonitor
from app.models.user import User
from app.services.alert_relationship_service import create_alert_relationships
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.firebase_helper import push_patient_alert

logger = logging.getLogger("medication.scheduler")

scheduler = BackgroundScheduler()


def _to_sunday_based_weekday(dt: datetime) -> int:
    # Python weekday: Monday=0..Sunday=6, app schedule uses Sunday=0..Saturday=6.
    return (dt.weekday() + 1) % 7


def _is_schedule_due_on_date(schedule: MedicationSchedule, date_value: datetime) -> bool:
    if schedule.schedule_type == "daily":
        return True

    days = schedule.days_of_week or []
    if not days:
        return False

    return _to_sunday_based_weekday(date_value) in days


def _parse_schedule_occurrences(schedule: MedicationSchedule, now_utc: datetime) -> list[tuple[datetime, datetime]]:
    occurrences: list[tuple[datetime, datetime]] = []
    scheduled_times = schedule.scheduled_times or []

    # Check today and yesterday so late-night windows are not missed.
    for day_offset in [0, -1]:
        base_date = now_utc + timedelta(days=day_offset)
        if not _is_schedule_due_on_date(schedule, base_date):
            continue

        for time_value in scheduled_times:
            try:
                hour, minute = map(int, str(time_value).split(":"))
            except Exception:
                logger.warning(f"[MEDICATION_SCHEDULER] Invalid scheduled time '{time_value}' for schedule {schedule.id}")
                continue

            scheduled_for_at = base_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            due_at = scheduled_for_at + timedelta(minutes=int(schedule.grace_period_minutes or 60))
            if due_at <= now_utc:
                occurrences.append((scheduled_for_at, due_at))

    return occurrences


def run_medication_check_for_all_patients():
    db = None
    now_utc = datetime.utcnow()

    try:
        db = SessionLocal()

        schedules = (
            db.query(MedicationSchedule)
            .join(User, User.id == MedicationSchedule.patient_id)
            .filter(
                MedicationSchedule.is_active == True,
                User.role == "patient",
            )
            .all()
        )

        if not schedules:
            return

        for schedule in schedules:
            occurrences = _parse_schedule_occurrences(schedule, now_utc)
            if not occurrences:
                continue

            for scheduled_for_at, due_at in occurrences:
                monitor = (
                    db.query(MedicationScheduleMonitor)
                    .filter(
                        MedicationScheduleMonitor.patient_id == schedule.patient_id,
                        MedicationScheduleMonitor.medication_schedule_id == schedule.id,
                        MedicationScheduleMonitor.scheduled_for_at == scheduled_for_at,
                    )
                    .first()
                )

                if not monitor:
                    monitor = MedicationScheduleMonitor(
                        patient_id=schedule.patient_id,
                        medication_schedule_id=schedule.id,
                        scheduled_for_at=scheduled_for_at,
                        due_at=due_at,
                        status="pending",
                        created_by=schedule.created_by,
                        checked_at=now_utc,
                        notes=f"Auto-created by scheduler for {schedule.name}",
                    )
                    db.add(monitor)
                    db.flush()

                if monitor.taken_at:
                    if monitor.status != "taken":
                        monitor.status = "taken"
                        monitor.checked_at = now_utc
                    continue

                # Not taken and due window passed -> missed
                if now_utc < due_at:
                    continue

                if monitor.status != "missed":
                    monitor.status = "missed"
                    monitor.checked_at = now_utc

                existing_breach = (
                    db.query(MedicationScheduleBreach)
                    .filter(MedicationScheduleBreach.monitor_id == monitor.id)
                    .first()
                )
                if existing_breach:
                    continue

                reason = (
                    f"Medication '{schedule.name}' not taken within "
                    f"{schedule.grace_period_minutes} minutes of scheduled time"
                )
                breach = MedicationScheduleBreach(
                    patient_id=schedule.patient_id,
                    medication_schedule_id=schedule.id,
                    monitor_id=monitor.id,
                    breach_found_at=now_utc,
                    created_by=schedule.created_by,
                    reason=reason,
                    status="active",
                )
                db.add(breach)
                db.flush()

                alert_priority = "high" if schedule.urgency_level == "high" else "medium"
                alert = Alert(
                    patient_id=schedule.patient_id,
                    alert_type="medication",
                    status="active",
                    priority=alert_priority,
                    title="Medication Missed",
                    message=reason,
                    is_added_to_emergency=schedule.urgency_level == "high",
                )
                db.add(alert)
                db.flush()

                breach.alert_id = alert.id
                create_alert_relationships(db, alert.id, schedule.patient_id)

                if schedule.urgency_level == "high":
                    patient_alert = PatientAlert(
                        patient_id=schedule.patient_id,
                        event_id=str(breach.id),
                        alert_type="MEDICATION_MISSED_HIGH",
                    )
                    db.add(patient_alert)
                    db.flush()
                    create_budii_alert_relationships(db, patient_alert.id, schedule.patient_id)

                    db.commit()
                    db.refresh(patient_alert)

                    pa_dict = patient_alert.to_dict()
                    patient_user = db.query(User).filter(User.id == schedule.patient_id).first()
                    pa_dict["patient_name"] = patient_user.full_name if patient_user else "Unknown"
                    push_patient_alert(pa_dict)
                else:
                    db.commit()

                logger.info(
                    f"[MEDICATION_SCHEDULER] Breach created patient={schedule.patient_id} "
                    f"schedule={schedule.id} monitor={monitor.id}"
                )

        db.commit()

    except Exception as exc:
        logger.exception(f"[MEDICATION_SCHEDULER] Failure: {exc}")
        if db:
            db.rollback()
    finally:
        if db:
            db.close()


def start_medication_scheduler():
    if scheduler.running:
        logger.info("[MEDICATION_SCHEDULER] Scheduler already running")
        return

    scheduler.add_job(
        run_medication_check_for_all_patients,
        "interval",
        seconds=1800,
        id="medication_check",
        name="Medication Check Every 30 Minutes",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[MEDICATION_SCHEDULER] Started - runs every 1800 seconds")


def stop_medication_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[MEDICATION_SCHEDULER] Stopped")
