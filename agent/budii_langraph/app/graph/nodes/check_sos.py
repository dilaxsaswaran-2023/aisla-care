import logging
from datetime import datetime

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

    if not event.last_sos_triggered_time:
        return {
            "rules_triggered": [{
                "triggered": True,
                "case": "SOS_TRIGGER",
                "action": "SEND_CONFIRMATION",
                "reason": "SOS triggered"
            }]
        }

    current = datetime.fromisoformat(event.sos_triggered_time.replace("Z", "+00:00"))
    last = datetime.fromisoformat(event.last_sos_triggered_time.replace("Z", "+00:00"))
    diff = int((current - last).total_seconds())

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