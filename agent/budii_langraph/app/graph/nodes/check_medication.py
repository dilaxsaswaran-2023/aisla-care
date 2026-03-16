import logging
from datetime import datetime, timedelta

logger = logging.getLogger("budii.graph.medication")


def check_medication(state):
    event = state["event"]
    medication_schedule = state.get("medication_schedule")

    if event.medicine_taken is None:
        logger.info(f"[MEDICATION] skipped event={event.event_id}")
        return {"rules_triggered": []}

    if not medication_schedule:
        logger.info(f"[MEDICATION] no schedule patient={event.patient_id}")
        return {"rules_triggered": []}

    event_dt = datetime.fromisoformat(event.timestamp.replace("Z", "+00:00"))
    grace_minutes = 10

    for med in medication_schedule:
        scheduled_time = med["scheduled_time"]
        hour, minute = map(int, scheduled_time.split(":"))

        scheduled_dt = event_dt.replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0
        )

        trigger_dt = scheduled_dt + timedelta(minutes=grace_minutes)

        logger.info(
            f"[MEDICATION] event={event.event_id} medicine={med['medicine_name']} "
            f"scheduled={scheduled_dt} trigger_after={trigger_dt} taken={event.medicine_taken}"
        )

        if event_dt >= trigger_dt and event.medicine_taken is False:
            logger.warning(
                f"[MEDICATION] missed medicine patient={event.patient_id} "
                f"medicine={med['medicine_name']}"
            )
            return {
                "rules_triggered": [{
                    "triggered": True,
                    "case": "MISSED_MEDICATION",
                    "action": "SEND_MEDICATION_ALERT",
                    "reason": f"Medication '{med['medicine_name']}' was not taken within {grace_minutes} minutes"
                }]
            }

    return {"rules_triggered": []}