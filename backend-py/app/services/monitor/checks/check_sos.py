import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.sos_alert import SosAlert
from app.services.monitor.schemas import MonitorEvent

logger = logging.getLogger("monitor.sos")


def check_sos(event: MonitorEvent, db: Session) -> list:
    """
    SOS logic ported from agent/budii_langraph/app/graph/nodes/check_sos.py.

    • First SOS or last SOS > 8 min ago  → SOS_TRIGGER / SEND_CONFIRMATION
    • Repeated SOS within 8 minutes      → SOS_REPEAT  / START_EMERGENCY
    """
    print(f"[SOS_CHECK] check_sos called with event_id={event.event_id}, sos_triggered={event.sos_triggered}")
    if not event.sos_triggered:
        print(f"[SOS_CHECK] skipped - sos_triggered is False")
        logger.info(f"[SOS] skipped event={event.event_id}")
        return []

    if not event.sos_triggered_time:
        logger.warning(f"[SOS] missing sos_triggered_time event={event.event_id}")
        return []

    try:
        current_time = datetime.fromisoformat(
            event.sos_triggered_time.replace("Z", "+00:00")
        )
    except Exception:
        logger.warning(f"[SOS] invalid sos_triggered_time event={event.event_id}")
        return []

    logger.info(f"[SOS] evaluating event={event.event_id}")

    try:
        patient_uuid = uuid.UUID(event.patient_id)
    except ValueError:
        logger.warning(f"[SOS] invalid patient_id={event.patient_id}")
        return []

    # Get the most recent previous SOS alert, excluding the current one
    # (the current SosAlert record is already committed when this runs)
    try:
        event_uuid = uuid.UUID(event.event_id)
    except ValueError:
        event_uuid = None

    query = (
        db.query(SosAlert)
        .filter(SosAlert.patient_id == patient_uuid)
        .order_by(desc(SosAlert.created_at))
    )
    if event_uuid is not None:
        query = query.filter(SosAlert.id != event_uuid)

    last_sos = query.first()

    if not last_sos:
        print(f"[SOS_CHECK] No previous SOS found - returning SOS_TRIGGER")
        return [{
            "triggered": True,
            "case": "SOS_TRIGGER",
            "action": "SEND_CONFIRMATION",
            "reason": "SOS triggered",
        }]

    last_time = last_sos.created_at

    # Normalise both to naive UTC for comparison
    if current_time.tzinfo is not None:
        current_time = current_time.astimezone(timezone.utc).replace(tzinfo=None)
    if last_time.tzinfo is not None:
        last_time = last_time.astimezone(timezone.utc).replace(tzinfo=None)

    diff = int((current_time - last_time).total_seconds())
    print(f"[SOS_CHECK] Seconds since last SOS: {diff}")
    logger.info(f"[SOS] seconds since last SOS: {diff}")

    if diff <= 480:  # 8 minutes
        print(f"[SOS_CHECK] SOS_REPEAT - within 8 minutes")
        return [{
            "triggered": True,
            "case": "SOS_REPEAT",
            "action": "START_EMERGENCY",
            "reason": "Repeated SOS within 8 minutes",
        }]

    print(f"[SOS_CHECK] SOS_TRIGGER - more than 8 minutes since last SOS")
    return [{
        "triggered": True,
        "case": "SOS_TRIGGER",
        "action": "SEND_CONFIRMATION",
        "reason": "SOS triggered",
    }]
