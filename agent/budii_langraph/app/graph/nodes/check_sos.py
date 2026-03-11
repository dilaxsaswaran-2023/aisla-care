import logging
from datetime import datetime, timezone

from database.db import SessionLocal
from database.queries import get_last_sos_alert_before

logger = logging.getLogger("budii.graph.sos")


def check_sos(state):
    event = state["event"]

    if not event.sos_triggered:
        logger.info(f"[SOS] skipped event={event.event_id}")
        return {"rules_triggered": []}

    if not event.sos_triggered_time:
        logger.warning(f"[SOS] missing sos_triggered_time event={event.event_id}")
        return {"rules_triggered": []}

    logger.info(f"[SOS] evaluating event={event.event_id}")

    try:
        current_time = datetime.fromisoformat(
            event.sos_triggered_time.replace("Z", "+00:00")
        )
    except Exception:
        logger.warning(f"[SOS] invalid sos_triggered_time event={event.event_id}")
        return {"rules_triggered": []}

    db = SessionLocal()
    try:
        last_sos_alert = get_last_sos_alert_before(
            db=db,
            patient_id=event.patient_id,
            current_time=current_time,
        )

        if not last_sos_alert:
            return {
                "rules_triggered": [{
                    "triggered": True,
                    "case": "SOS_TRIGGER",
                    "action": "SEND_CONFIRMATION",
                    "reason": "SOS triggered"
                }]
            }

        last_time = last_sos_alert.created_at

        # normalize both to naive UTC
        if current_time.tzinfo is not None:
            current_time = current_time.astimezone(timezone.utc).replace(tzinfo=None)

        if last_time.tzinfo is not None:
            last_time = last_time.astimezone(timezone.utc).replace(tzinfo=None)

        diff = int((current_time - last_time).total_seconds())

        if diff <= 480:
            return {
                "rules_triggered": [{
                    "triggered": True,
                    "case": "SOS_REPEAT",
                    "action": "START_EMERGENCY",
                    "reason": "Repeated SOS within 8 minutes"
                }]
            }

        return {
            "rules_triggered": [{
                "triggered": True,
                "case": "SOS_TRIGGER",
                "action": "SEND_CONFIRMATION",
                "reason": "SOS triggered"
            }]
        }

    except Exception as e:
        logger.exception(f"[SOS] failed event={event.event_id}: {e}")
        return {"rules_triggered": []}

    finally:
        db.close()