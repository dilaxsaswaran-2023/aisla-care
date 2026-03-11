import logging
from sqlalchemy.orm import Session
from app.services.monitor.schemas import MonitorEvent

logger = logging.getLogger("monitor.inactive")


def check_inactive(event: MonitorEvent, db: Session) -> list:
    """Stub — not yet implemented. Set CHECK_INACTIVE_ENABLED=false in .env."""
    logger.debug(f"[INACTIVE] check not implemented, skipping event={event.event_id}")
    return []
