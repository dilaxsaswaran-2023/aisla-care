import logging
from repository import save_rule_result

logger = logging.getLogger("budii.graph.persist")


def persist_results(state):
    event = state["event"]
    final_result = state.get("final_result", {
        "triggered": False,
        "rules_triggered": []
    })

    logger.info(f"[PERSIST] saving event={event.event_id}")
    save_rule_result(event, final_result)

    return {}