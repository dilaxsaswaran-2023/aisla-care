import logging

logger = logging.getLogger("budii.graph.aggregate")


def aggregate_results(state):
    rules = state.get("rules_triggered", [])
    triggered = len(rules) > 0

    logger.info(f"[AGGREGATE] rules_triggered={len(rules)}")

    return {
        "triggered": triggered,
        "final_result": {
            "triggered": triggered,
            "rules_triggered": rules
        }
    }