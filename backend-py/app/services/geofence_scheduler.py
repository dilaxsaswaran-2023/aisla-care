"""
Background scheduled geofence checker.
Runs independently every minute for all patient-type users.
"""
import logging
import uuid
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.patient_location import PatientCurrentLocation
from app.models.budii_alert import PatientAlert
from app.services.monitor.schemas import MonitorEvent
from app.services.monitor.checks.check_geofence import check_geofence
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.alert_relationship_service import create_alert_relationships
from app.models.alert import Alert

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
        
        # Query all patients with geofencing enabled
        patients = (
            db.query(User)
            .filter(
                User.role == "patient",
                User.is_geofencing == True,
            )
            .all()
        )
        
        if not patients:
            logger.debug("[GEOFENCE_SCHEDULER] No patients with geofencing enabled")
            return
        
        logger.info(f"[GEOFENCE_SCHEDULER] Checking {len(patients)} patients")
        
        for patient in patients:
            # Get patient's current location
            location = (
                db.query(PatientCurrentLocation)
                .filter(PatientCurrentLocation.patient_id == patient.id)
                .first()
            )
            
            if location is None:
                logger.debug(f"[GEOFENCE_SCHEDULER] No location data for patient {patient.id}")
                continue
            
            # Create a MonitorEvent from the patient's current location
            event = MonitorEvent(
                event_id=str(uuid.uuid4()),
                patient_id=str(patient.id),
                timestamp=datetime.utcnow().isoformat(),
                lat=location.lat,
                lng=location.lng,
                sos_triggered=False,
            )
            
            # Run geofence check
            rules = check_geofence(event, db)
            
            if not rules:
                continue
            
            # Process triggered rules
            for rule in rules:
                if rule["case"] == "GEOFENCE_BREACH":
                    logger.warning(
                        f"[GEOFENCE_SCHEDULER] Geofence breach detected for patient {patient.id} "
                        f"distance={rule['context'].get('distance_meters')}m"
                    )
                    
                    # Create main Alert (frontend-visible)
                    alert = Alert(
                        patient_id=patient.id,
                        alert_type="geofence",
                        status="active",
                        priority="high",
                        title="Geofence Boundary Breach",
                        message=rule.get("reason", "Patient outside home boundary"),
                        latitude=location.lat,
                        longitude=location.lng,
                    )
                    db.add(alert)
                    db.flush()  # Get alert.id before creating relationships
                    
                    # Create alert relationships for caregivers and family members
                    create_alert_relationships(db, alert.id, patient.id)
                    
                    # Also create PatientAlert for audit log
                    patient_alert = PatientAlert(
                        patient_id=patient.id,
                        event_id=event.event_id,
                        case=rule["case"],
                        alert_type="geofence",
                        title=rule.get("reason", "Geofence breach"),
                        message=rule.get("reason", ""),
                        status="active",
                        source="scheduler",
                    )
                    db.add(patient_alert)
                    db.flush()
                    
                    # Create budii alert relationships for all caregivers and family members
                    create_budii_alert_relationships(db, patient_alert.id, patient.id)
                    
                    db.commit()
                    logger.info(f"[GEOFENCE_SCHEDULER] Created geofence breach alert for patient {patient.id}")
    
    except Exception as e:
        logger.exception(f"[GEOFENCE_SCHEDULER] Error in scheduled geofence check: {type(e).__name__}: {e}")
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
    
    # Add job: run geofence check every 60 seconds
    scheduler.add_job(
        run_geofence_check_for_all_patients,
        "interval",
        seconds=60,
        id="geofence_check",
        name="Geofence Check Every Minute",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("[GEOFENCE_SCHEDULER] Started - runs every 60 seconds")


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[GEOFENCE_SCHEDULER] Stopped")
