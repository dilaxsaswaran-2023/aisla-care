import logging

logger = logging.getLogger("budii.graph.ingest")


def ingest_event(state):
    event = state["event"]

    logger.info(f"[INGEST] event={event.event_id} patient={event.patient_id}")

    return {
        "patient_id": event.patient_id,
        "rules_triggered": [],
        "actions": []
    }