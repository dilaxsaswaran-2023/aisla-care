"""Database bootstrap for the Budii agent.

This module adds the backend-py directory to sys.path so that the agent
can import shared SQLAlchemy models and the database session from backend-py.
No duplicate DB config – both services share the same PostgreSQL instance
configured via backend-py/.env.
"""
import sys
import uuid
import logging
from pathlib import Path
from sqlalchemy import select, text

# ---------------------------------------------------------------------------
# Path setup – must come before any backend-py imports
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parents[4] / "backend-py"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Load backend-py .env BEFORE importing backend-py database config so that
# SQLAlchemy engine gets the correct DATABASE_URL (and Twilio credentials)
# regardless of the current working directory.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

# ---------------------------------------------------------------------------
# Shared imports from backend-py
# ---------------------------------------------------------------------------
from app.database import SessionLocal, engine, Base  # noqa: E402
from app.models.patient_geofence import PatientGeofence  # noqa: E402
from app.models.medication_schedule import MedicationSchedule  # noqa: E402
from app.models.patient_active_hours import PatientActiveHours  # noqa: E402
from app.models.agent_event import AgentEvent  # noqa: E402

logger = logging.getLogger("budii.db")

# ---------------------------------------------------------------------------
# Fixed dummy UUIDs for local testing
# ---------------------------------------------------------------------------
PATIENT_1_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
PATIENT_2_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
PATIENT_3_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")


def get_session():
    """Return a new SQLAlchemy session backed by the shared PostgreSQL DB."""
    return SessionLocal()


import json
from sqlalchemy import text

def ensure_dummy_users(session):
    session.execute(
        text("""
            INSERT INTO users (
                id,
                email,
                password,
                full_name,
                role,
                status,
                is_geofencing,
                location_boundary,
                boundary_radius,
                geofence_state,
                geofence_outside_count
            )
            VALUES
                (:u1, :e1, :p1, :n1, :r1, :s1, :g1, CAST(:lb1 AS json), :br1, :gs1, :gc1),
                (:u2, :e2, :p2, :n2, :r2, :s2, :g2, CAST(:lb2 AS json), :br2, :gs2, :gc2),
                (:u3, :e3, :p3, :n3, :r3, :s3, :g3, CAST(:lb3 AS json), :br3, :gs3, :gc3)
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "u1": PATIENT_1_ID,
            "u2": PATIENT_2_ID,
            "u3": PATIENT_3_ID,

            "e1": "patient1@budii.test",
            "e2": "patient2@budii.test",
            "e3": "patient3@budii.test",

            "p1": "dummy_password_1",
            "p2": "dummy_password_2",
            "p3": "dummy_password_3",

            "n1": "Patient One",
            "n2": "Patient Two",
            "n3": "Patient Three",

            "r1": "patient",
            "r2": "patient",
            "r3": "patient",

            "s1": "active",
            "s2": "active",
            "s3": "active",

            "g1": True,
            "g2": True,
            "g3": True,

            "lb1": json.dumps({"latitude": 6.9271, "longitude": 79.8612}),
            "lb2": json.dumps({"latitude": 6.9275, "longitude": 79.8615}),
            "lb3": json.dumps({"latitude": 6.9280, "longitude": 79.8620}),

            "br1": 150.0,
            "br2": 200.0,
            "br3": 100.0,

            "gs1": "inside",
            "gs2": "inside",
            "gs3": "inside",

            "gc1": 0,
            "gc2": 0,
            "gc3": 0,
        },
    )

def seed_geofence(session):
    geofence_rows = [
        {
            "patient_id": PATIENT_1_ID,
            "home_lat": 6.9271,
            "home_lng": 79.8612,
            "radius_meters": 150,
        },
        {
            "patient_id": PATIENT_2_ID,
            "home_lat": 6.9275,
            "home_lng": 79.8615,
            "radius_meters": 150,
        },
        {
            "patient_id": PATIENT_3_ID,
            "home_lat": 6.9279,
            "home_lng": 79.8620,
            "radius_meters": 150,
        },
    ]

    for row in geofence_rows:
        stmt = select(PatientGeofence).where(
            PatientGeofence.patient_id == row["patient_id"]
        )
        exists = session.execute(stmt).scalar_one_or_none()
        if not exists:
            session.add(PatientGeofence(**row))


def seed_medication_schedule(session):
    medication_rows = [
        {
            "patient_id": PATIENT_1_ID,
            "medicine_name": "Blood Pressure Tablet",
            "scheduled_time": "08:00",
            "is_active": 1,
        },
        {
            "patient_id": PATIENT_1_ID,
            "medicine_name": "Vitamin D",
            "scheduled_time": "20:00",
            "is_active": 1,
        },
        {
            "patient_id": PATIENT_2_ID,
            "medicine_name": "Diabetes Tablet",
            "scheduled_time": "09:00",
            "is_active": 1,
        },
        {
            "patient_id": "301f754a-5919-4523-b51c-e424fb10e96c",
            "medicine_name": "Cholesterol Tablet",
            "scheduled_time": "07:30",
            "is_active": 1,
        }
    ]

    for row in medication_rows:
        stmt = select(MedicationSchedule).where(
            MedicationSchedule.patient_id == row["patient_id"],
            MedicationSchedule.medicine_name == row["medicine_name"],
            MedicationSchedule.scheduled_time == row["scheduled_time"],
        )
        exists = session.execute(stmt).scalar_one_or_none()
        if not exists:
            session.add(MedicationSchedule(**row))


def seed_active_hours(session):
    active_hours_rows = [
        {
            "patient_id": PATIENT_1_ID,
            "active_start": "06:00",
            "active_end": "22:00",
        },
        {
            "patient_id": PATIENT_2_ID,
            "active_start": "07:00",
            "active_end": "21:00",
        },
        {
            "patient_id": PATIENT_3_ID,
            "active_start": "06:30",
            "active_end": "21:30",
        },
        {
            "patient_id": "301f754a-5919-4523-b51c-e424fb10e96c",
            "active_start": "08:00",
            "active_end": "20:00",
        }
    ]

    for row in active_hours_rows:
        stmt = select(PatientActiveHours).where(
            PatientActiveHours.patient_id == row["patient_id"]
        )
        exists = session.execute(stmt).scalar_one_or_none()
        if not exists:
            session.add(PatientActiveHours(**row))


def seed_defaults(session):
    """Insert default seed data if it does not already exist."""
    ensure_dummy_users(session)
    seed_geofence(session)
    seed_medication_schedule(session)
    seed_active_hours(session)
    session.commit()


def init_db():
    """Ensure agent-specific tables exist in the shared PostgreSQL database."""
    logger.info("[DB] Creating agent tables if they do not exist")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            PatientGeofence.__table__,
            MedicationSchedule.__table__,
            PatientActiveHours.__table__,
            AgentEvent.__table__,
        ],
    )
    logger.info("[DB] Agent tables ready")

    session = SessionLocal()
    try:
        logger.info("[DB] Seeding default data if missing")
        seed_defaults(session)
        logger.info("[DB] Seed data ready")
    except Exception:
        session.rollback()
        logger.exception("[DB] Failed while seeding default data")
        raise
    finally:
        session.close()