"""
Publish events to the budii_langraph agent (port 8000).
Mirrors the simulator's publishing pattern.
"""
import requests
import logging
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger("app.agent_publisher")

AGENT_BASE_URL = "http://127.0.0.1:8000"
AGENT_TIMEOUT = 5


def publish_to_agent(event: Dict[str, Any]) -> bool:
    """
    Publish an event to the agent's /events endpoint.
    Returns True if successful, False otherwise.
    """
    try:
        url = f"{AGENT_BASE_URL}/events"
        response = requests.post(url, json=event, timeout=AGENT_TIMEOUT)
        response.raise_for_status()
        logger.info(f"✓ Published event to agent: event_id={event.get('event_id')}")
        return True
    except requests.exceptions.ConnectionError:
        logger.warning(f"⚠ Agent unreachable at {AGENT_BASE_URL}")
        return False
    except Exception as e:
        logger.error(f"✗ Failed to publish event to agent: {e}")
        return False


def publish_sos_to_agent(patient_id: str, voice_transcription: str | None = None) -> bool:
    """
    Publish an SOS event to the agent.
    
    Args:
        patient_id: UUID of the patient who triggered SOS
        voice_transcription: Optional voice message from the patient
    
    Returns:
        True if published successfully to agent, False otherwise
    """
    import uuid as uuid_module
    
    event = {
        "event_id": str(uuid_module.uuid4()),
        "patient_id": patient_id,
        "timestamp": datetime.utcnow().isoformat(),
        "sos_triggered": True,
        "sos_triggered_time": datetime.utcnow().isoformat(),
    }
    
    logger.info(
        f"[AGENT_PUBLISH] Publishing SOS: "
        f"patient_id={patient_id} has_voice={bool(voice_transcription)}"
    )
    
    return publish_to_agent(event)
