"""
Background scheduled geofence checker.
Runs independently every minute for all patient-type users.
"""
import logging
import uuid
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.user import User
from app.models.patient_location import PatientCurrentLocation
from app.models.budii_alert import PatientAlert
from app.services.monitor.schemas import MonitorEvent
from app.services.monitor.checks.check_geofence import check_geofence
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.alert_relationship_service import create_alert_relationships
from app.models.alert import Alert
from app.models.geofence_breach_event import GeofenceBreachEvent
from app.services.firebase_helper import push_patient_alert

logger = logging.getLogger("geofence.scheduler")

scheduler = BackgroundScheduler()


def run_geofence_check_for_all_patients():
    """
    Runs geofence check every minute for all patients with geofencing enabled.
    Triggered independently, not on-demand.
    """
    db = None
    try:
        db = SessionLocal()
        patients = (
            db.query(User)
            .filter(
                User.role == "patient",
                User.is_geofencing == True,
            )
            .all()
        )
        if not patients:
            return
        for patient in patients:
            location = (
                db.query(PatientCurrentLocation)
                .filter(PatientCurrentLocation.patient_id == patient.id)
                .first()
            )
            if location is None:
                continue
            event = MonitorEvent(
                event_id=str(uuid.uuid4()),
                patient_id=str(patient.id),
                timestamp=datetime.now(timezone.utc).isoformat(),
                lat=location.lat,
                lng=location.lng,
                sos_triggered=False,
            )
            rules = check_geofence(event, db)
            if not rules:
                continue
            for rule in rules:
                try:
                    logger.info(f"[GEOFENCE_SCHEDULER] Rule triggered for patient {patient.id}: {rule}")

                    if rule["case"] != "GEOFENCE_BREACH":
                        continue

                    logger.info("[GEOFENCE_SCHEDULER] Step 1 - creating breach")
                    breach = GeofenceBreachEvent(
                        patient_id=patient.id,
                        latitude=location.lat,
                        longitude=location.lng,
                        distance_meters=rule.get("context", {}).get("distance_meters"),
                        breached_at=datetime.now(timezone.utc),
                    )
                    db.add(breach)
                    db.flush()
                    logger.info(f"[GEOFENCE_SCHEDULER] Step 1 OK - breach.id={breach.id}")

                    logger.info("[GEOFENCE_SCHEDULER] Step 2 - creating alert")
                    alert = Alert(
                        patient_id=patient.id,
                        alert_type="geofence",
                        status="active",
                        priority="high",
                        title="Geofence Boundary Breach",
                        message=rule.get("reason", "Patient outside home boundary"),
                        latitude=location.lat,
                        longitude=location.lng,
                        is_added_to_emergency=True,
                    )
                    db.add(alert)
                    db.flush()
                    logger.info(f"[GEOFENCE_SCHEDULER] Step 2 OK - alert.id={alert.id}")

                    logger.info("[GEOFENCE_SCHEDULER] Step 3 - creating alert relationships")
                    create_alert_relationships(db, alert.id, patient.id)
                    logger.info("[GEOFENCE_SCHEDULER] Step 3 OK")

                    logger.info("[GEOFENCE_SCHEDULER] Step 4 - creating patient_alert")
                    patient_alert = PatientAlert(
                        patient_id=patient.id,
                        event_id=str(breach.id),
                        alert_type=rule["case"],
                    )
                    db.add(patient_alert)
                    db.flush()
                    logger.info(f"[GEOFENCE_SCHEDULER] Step 4 OK - patient_alert.id={patient_alert.id}")

                    logger.info("[GEOFENCE_SCHEDULER] Step 5 - creating budii alert relationships")
                    create_budii_alert_relationships(db, patient_alert.id, patient.id)
                    logger.info("[GEOFENCE_SCHEDULER] Step 5 OK")

                    logger.info("[GEOFENCE_SCHEDULER] Step 6 - commit")
                    db.commit()
                    logger.info("[GEOFENCE_SCHEDULER] Step 6 OK - commit success")

                    db.refresh(patient_alert)

                    pa_dict = patient_alert.to_dict()
                    patient_user = db.query(User).filter(User.id == patient.id).first()
                    pa_dict["patient_name"] = patient_user.full_name if patient_user else "Unknown"
                    push_patient_alert(pa_dict)

                    logger.info(f"[GEOFENCE_SCHEDULER] Created geofence breach alert for patient {patient.id}")

                except Exception as e:
                    logger.exception(f"[GEOFENCE_SCHEDULER] FAILED for patient {patient.id}: {e}")
                    db.rollback()

    except Exception as e:
        logger.exception(f"[GEOFENCE_SCHEDULER] Outer failure: {e}")
        if db:
            db.rollback()
    finally:
        if db:
            db.close()


def start_scheduler():
    """Initialize and start the background scheduler."""
    if scheduler.running:
        logger.info("[GEOFENCE_SCHEDULER] Scheduler already running")
        return

    scheduler.add_job(
        run_geofence_check_for_all_patients,
        "interval",
        seconds=30,
        id="geofence_check",
        name="Geofence Check Every 5 Minutes",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[GEOFENCE_SCHEDULER] Started - runs every 300 seconds")


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[GEOFENCE_SCHEDULER] Stopped")