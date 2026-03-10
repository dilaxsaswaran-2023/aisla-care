import logging

logger = logging.getLogger("budii.graph.medication")


def check_medication(state):
    event = state["event"]
    schedule = state.get("medication_schedule", [])

    if event.medicine_taken is None:
        logger.info(f"[MEDICATION] skipped event={event.event_id}")
        return {"rules_triggered": []}

    if event.medicine_taken:
        logger.info(f"[MEDICATION] already taken event={event.event_id}")
        return {"rules_triggered": []}

    if not schedule:
        logger.info(f"[MEDICATION] no schedule patient={event.patient_id}")
        return {"rules_triggered": []}

    logger.warning(f"[MEDICATION] missed medication event={event.event_id}")
    return {
        "rules_triggered": [{
            "triggered": True,
            "case": "MISSED_MEDICATION",
            "action": "SEND_REMINDER",
            "reason": "Medication not taken"
        }]
    }