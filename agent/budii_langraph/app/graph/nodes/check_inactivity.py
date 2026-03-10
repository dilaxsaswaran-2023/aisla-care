import logging

logger = logging.getLogger("budii.graph.inactivity")


def check_inactivity(state):
    event = state["event"]
    active_hours = state.get("active_hours")

    if event.movement is None:
        logger.info(f"[INACTIVITY] skipped event={event.event_id}")
        return {"rules_triggered": []}

    if not active_hours:
        logger.info(f"[INACTIVITY] no active hours patient={event.patient_id}")
        return {"rules_triggered": []}

    if event.movement is False:
        logger.warning(f"[INACTIVITY] no movement event={event.event_id}")
        return {
            "rules_triggered": [{
                "triggered": True,
                "case": "NO_MOVEMENT",
                "action": "SEND_UNUSUAL_ACTIVITY_ALERT",
                "reason": "No movement detected during active time"
            }]
        }

    return {"rules_triggered": []}