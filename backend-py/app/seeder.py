from passlib.context import CryptContext
from sqlalchemy.orm import Session
from datetime import time

from app.models.patient_activity_schedule import PatientActivitySchedule
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SUPER_ADMIN_EMAIL = "senz@gmail.com"
SUPER_ADMIN_PASSWORD = "password"
SUPER_ADMIN_NAME = "Super Admin"


def seed_super_admin(db: Session) -> None:
    """Seeds the super-admin user once. If they already exist in the DB, this is a no-op."""
    existing = db.query(User).filter(User.email == SUPER_ADMIN_EMAIL).first()
    if existing:
        print("Super-admin already exists — skipping seed")
        return

    hashed = pwd_context.hash(SUPER_ADMIN_PASSWORD)
    user = User(
        email=SUPER_ADMIN_EMAIL,
        password=hashed,
        full_name=SUPER_ADMIN_NAME,
        role="super_admin",
        status="active",
    )
    db.add(user)
    db.commit()
    print(f"Super-admin seeded: {SUPER_ADMIN_EMAIL}")


def seed_patient_activity_schedule(db: Session) -> None:
    """Seed default activity schedules for all patient users."""
    patients = db.query(User).filter(User.role == "patient").all()

    if not patients:
        print("No patient users found — skipping activity schedule seed")
        return

    default_activities = [
        {"activity_name": "breakfast", "start_time": time(7, 0), "end_time": time(8, 0)},
        {"activity_name": "walking", "start_time": time(16, 0), "end_time": time(17, 0)}
    ]

    for patient in patients:
        existing = (
            db.query(PatientActivitySchedule)
            .filter(PatientActivitySchedule.patient_id == patient.id)
            .first()
        )

        if existing:
            print(f"Activity schedule already exists for patient {patient.email} — skipping")
            continue

        for activity in default_activities:
            row = PatientActivitySchedule(
                patient_id=patient.id,
                activity_name=activity["activity_name"],
                start_time=activity["start_time"],
                end_time=activity["end_time"],
            )
            db.add(row)

    db.commit()
    print("Patient activity schedules seeded")