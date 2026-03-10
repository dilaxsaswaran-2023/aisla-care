"""Repository layer for the Budii agent.

Persists agent-processed events to the shared PostgreSQL database using
the AgentEvent model defined in backend-py/app/models/agent_event.py.
"""
import json
import logging

from database.db import get_session  # also ensures sys.path + models are loaded
from app.models.agent_event import AgentEvent

logger = logging.getLogger("budii.repository")


def save_rule_result(event, result: dict) -> None:
    """Persist a processed event result to the agent_events table."""
    session = get_session()
    try:
        record = AgentEvent(
            event_id=event.event_id,
            patient_id=event.patient_id,
            timestamp=event.timestamp,
            result_json=json.dumps(result),
        )
        session.add(record)
        session.commit()
        logger.info(f"[REPO] Saved agent event: event_id={event.event_id}")
    except Exception:
        session.rollback()
        logger.exception(f"[REPO] Failed to save event_id={event.event_id}")
        raise
    finally:
        session.close()

