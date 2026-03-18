import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.services.monitor.schemas import MonitorEvent

logger = logging.getLogger("monitor.inactive")


def check_inactivity(state):
    event = state["event"]
    active_hours = state.get("active_hours")

    if event.movement is None:
        logger.info(f"[INACTIVITY] skipped event={event.event_id}")
        return {"rules_triggered": []}

    if not active_hours:
        logger.info(f"[INACTIVITY] no active hours patient={event.patient_id}")
        return {"rules_triggered": []}

    # parse event timestamp
    event_dt = datetime.fromisoformat(event.timestamp.replace("Z", "+00:00"))
    event_time = event_dt.time()

    # DB values like "08:00", "20:00"
    active_start = datetime.strptime(active_hours["active_start"], "%H:%M").time()
    active_end = datetime.strptime(active_hours["active_end"], "%H:%M").time()

    logger.info(
        f"[INACTIVITY] event={event.event_id} event_time={event_time} "
        f"active_start={active_start} active_end={active_end} movement={event.movement}"
    )

    # normal same-day range, e.g. 08:00 -> 20:00
    is_within_active_hours = active_start <= event_time <= active_end

    if not is_within_active_hours:
        logger.info(
            f"[INACTIVITY] outside active hours event={event.event_id} patient={event.patient_id}"
        )
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