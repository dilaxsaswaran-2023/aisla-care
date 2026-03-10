import logging

logger = logging.getLogger("budii.graph.actions")


def create_actions(state):
    rules = state.get("rules_triggered", [])

    actions = []
    for rule in rules:
        actions.append({
            "case": rule["case"],
            "action": rule["action"],
            "reason": rule["reason"]
        })

    logger.info(f"[ACTIONS] created={len(actions)}")

    return {"actions": actions}