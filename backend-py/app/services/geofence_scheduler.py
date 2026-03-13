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
            return
        
        for patient in patients:
            # Get patient's current location
            location = (
                db.query(PatientCurrentLocation)
                .filter(PatientCurrentLocation.patient_id == patient.id)
                .first()
            )
            
            if location is None:
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
                    # Create breach record first
                    breach = GeofenceBreachEvent(
                        patient_id=patient.id,
                        latitude=location.lat,
                        longitude=location.lng,
                        distance_meters=rule["context"].get("distance_meters"),
                        breached_at=datetime.utcnow(),
                    )
                    db.add(breach)
                    db.flush()   # now breach.id is available
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
                        is_added_to_emergency=True,
                    )
                    db.add(alert)
                    db.flush()
                    create_alert_relationships(db, alert.id, patient.id)

                    # PatientAlert uses breach.id as event_id
                    patient_alert = PatientAlert(
                        patient_id=patient.id,
                        event_id=str(breach.id),   # same value as breach table primary key
                        case=rule["case"],
                        alert_type="geofence",
                        title=rule.get("reason", "Geofence breach"),
                        message=rule.get("reason", ""),
                        status="active",
                        source="scheduler",
                        is_added_to_emergency=True,
                    )
                    db.add(patient_alert)
                    db.flush()
                    create_budii_alert_relationships(db, patient_alert.id, patient.id)

                    db.commit()
                    db.refresh(patient_alert)

                    # Push to Firebase for real-time frontend listeners
                    pa_dict = patient_alert.to_dict()
                    patient_user = db.query(User).filter(User.id == patient.id).first()
                    pa_dict["patient_name"] = patient_user.full_name if patient_user else "Unknown"
                    push_patient_alert(pa_dict)

                    logger.info(f"[GEOFENCE_SCHEDULER] Created geofence breach alert for patient {patient.id}")
    
    except Exception:
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
    
    # Add job: run geofence check every 300 seconds
    scheduler.add_job(
        run_geofence_check_for_all_patients,
        "interval",
        seconds=300,
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
