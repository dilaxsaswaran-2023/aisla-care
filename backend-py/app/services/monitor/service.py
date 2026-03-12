import logging
import uuid

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.alert import Alert
from app.models.budii_alert import PatientAlert
from app.services.alert_relationship_service import create_alert_relationships
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
from app.services.firebase_helper import push_patient_alert
from app.services.monitor.schemas import MonitorEvent
from app.services.monitor.checks.check_sos import check_sos
from app.services.monitor.checks.check_geofence import check_geofence
from app.services.monitor.checks.check_inactive import check_inactive
from app.services.monitor.checks.check_medication import check_medication

logger = logging.getLogger("monitor.service")


def _case_to_alert_type(case: str) -> str:
    if "SOS" in case:
        return "sos"
    if "GEOFENCE" in case:
        return "geofence"
    if "MEDICATION" in case or "MISSED" in case:
        return "health"
    if "MOVEMENT" in case or "INACTIVE" in case or "INACTIVITY" in case:
        return "inactivity"
    return "health"


def _case_to_priority(case: str) -> str:
    if case in ("SOS_REPEAT", "START_EMERGENCY"):
        return "critical"
    if "SOS" in case or "GEOFENCE" in case:
        return "high"
    return "medium"


async def process_event(event: MonitorEvent, db: Session, sio=None) -> list:
    """
    ⚠️  DEPRECATED - No longer used in the main application flow.
    
    This function was the main event processor before we refactored to independent checks:
    - SOS checks are now triggered directly via check_sos_direct() in /api/alerts/sos endpoint
    - Geofence checks run independently via geofence_scheduler every 60 seconds
    
    Keeping for backward compatibility with external integrations or testing.
    All new monitoring should use the independent check functions directly.
    """
    print(f"[MONITOR] process_event called with patient_id={event.patient_id}, event_id={event.event_id}")
    settings = get_settings()
    all_rules: list[dict] = []

    if settings.check_sos_enabled:
        all_rules.extend(check_sos(event, db))

    if settings.check_geofence_enabled:
        all_rules.extend(check_geofence(event, db))

    if settings.check_inactive_enabled:
        all_rules.extend(check_inactive(event, db))

    if settings.check_medication_enabled:
        all_rules.extend(check_medication(event, db))

    if not all_rules:
        return []

    patient_uuid = uuid.UUID(event.patient_id)

    for rule in all_rules:
        alert_type = _case_to_alert_type(rule["case"])

        # ── PatientAlert: audit log entry (skip SOS_TRIGGER, only log SOS_REPEAT) ───
        # SOS_TRIGGER: initial SOS alert already created by /api/alerts/sos endpoint
        # SOS_REPEAT: escalation within 8 min, should be logged in patient_alerts + create relationships
        if rule["case"] == "SOS_REPEAT":
            patient_alert = PatientAlert(
                patient_id=patient_uuid,
                event_id=event.event_id,
                case=rule["case"],
                alert_type=alert_type,
                title=rule["reason"],
                message=rule.get("reason", ""),
                status="active",
                source="monitor",
            )
            db.add(patient_alert)
            db.flush()  # Get patient_alert.id before creating relationships
            # Create budii alert relationships for all caregivers and family members
            print(f"[MONITOR] About to create_budii_alert_relationships for patient_alert.id={patient_alert.id}, patient_uuid={patient_uuid}")
            result = create_budii_alert_relationships(db, patient_alert.id, patient_uuid)
            print(f"[MONITOR] create_budii_alert_relationships returned: {result}")

            # Push to Firebase for real-time frontend listeners
            push_patient_alert(patient_alert.to_dict())

        # ── For non-SOS rules, create a user-visible Alert + relationships ────
        # (SOS alert is already created by the /api/alerts/sos endpoint)
        if "SOS" not in rule["case"]:
            context = rule.get("context") or {}
            alert = Alert(
                patient_id=patient_uuid,
                alert_type=alert_type,
                status="active",
                priority=_case_to_priority(rule["case"]),
                title=rule["reason"],
                message=rule.get("reason", ""),
                latitude=event.lat,
                longitude=event.lng,
            )
            db.add(alert)
            db.flush()  # get alert.id before creating relationships
            create_alert_relationships(db, alert.id, patient_uuid)

    print(f"[MONITOR] About to commit database changes. Rules processed: {len(all_rules)}")
    db.commit()
    print(f"[MONITOR] Database commit completed successfully")

    if sio:
        try:
            await sio.emit("new_alert", {
                "patient_id": event.patient_id,
                "event_id": event.event_id,
                "rules": all_rules,
            })
        except Exception as exc:
            logger.warning(f"[MONITOR] socket emit failed: {exc}")

    logger.info(
        f"[MONITOR] processed event={event.event_id} "
        f"patient={event.patient_id} rules={len(all_rules)}"
    )
    return all_rules
