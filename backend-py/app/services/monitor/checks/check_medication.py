import logging
from sqlalchemy.orm import Session
from app.services.monitor.schemas import MonitorEvent

logger = logging.getLogger("monitor.medication")


def check_medication(event: MonitorEvent, db: Session) -> list:
    """Stub — not yet implemented. Set CHECK_MEDICATION_ENABLED=false in .env."""
    logger.debug(f"[MEDICATION] check not implemented, skipping event={event.event_id}")
    return []
