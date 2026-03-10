"""Database bootstrap for the Budii agent.

This module adds the backend-py directory to sys.path so that the agent
can import shared SQLAlchemy models and the database session from backend-py.
No duplicate DB config – both services share the same PostgreSQL instance
configured via backend-py/.env.
"""
import sys
import logging
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup – must come before any backend-py imports
# ---------------------------------------------------------------------------
# __file__ is  agent/budii_langraph/app/database/db.py
# parents[0]  agent/budii_langraph/app/database/
# parents[1]  agent/budii_langraph/app/
# parents[2]  agent/budii_langraph/
# parents[3]  agent/
# parents[4]  <workspace root>
_BACKEND_DIR = Path(__file__).resolve().parents[4] / "backend-py"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ---------------------------------------------------------------------------
# Shared imports from backend-py
# ---------------------------------------------------------------------------
from app.database import SessionLocal, engine, Base  # noqa: E402
from app.models.medication_schedule import MedicationSchedule  # noqa: E402, F401
from app.models.patient_active_hours import PatientActiveHours  # noqa: E402, F401
from app.models.agent_event import AgentEvent  # noqa: E402, F401

logger = logging.getLogger("budii.db")


def get_session():
    """Return a new SQLAlchemy session backed by the shared PostgreSQL DB."""
    return SessionLocal()


def init_db():
    """Ensure agent-specific tables exist in the shared PostgreSQL database."""
    logger.info("[DB] Creating agent tables if they do not exist")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            MedicationSchedule.__table__,
            PatientActiveHours.__table__,
            AgentEvent.__table__,
        ],
    )
    logger.info("[DB] Agent tables ready")

