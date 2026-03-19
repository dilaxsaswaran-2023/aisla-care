import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal


@dataclass
class SqlStep:
    label: str
    sql: str


DELETE_STEPS = [
    SqlStep("patient_alert_relationships", "DELETE FROM patient_alert_relationships"),
    SqlStep("patient_alerts", "DELETE FROM patient_alerts"),
    SqlStep("sos_alerts", "DELETE FROM sos_alerts"),
    SqlStep("medication_schedule_breaches", "DELETE FROM medication_schedule_breaches"),
    SqlStep("patient_inactivity_logs", "DELETE FROM patient_inactivity_logs"),
    SqlStep("geofence_breach_events", "DELETE FROM geofence_breach_events"),
]

OPTIONAL_LOCATION_STEPS = [
    SqlStep("patient_location_recent", "DELETE FROM patient_location_recent"),
    SqlStep("patient_current_location", "DELETE FROM patient_current_location"),
    SqlStep("gps_locations", "DELETE FROM gps_locations"),
]

RESET_GEOFENCE_ON_USERS_SQL = """
UPDATE users
SET
  is_geofencing = FALSE,
  location_boundary = NULL,
  boundary_radius = NULL,
  geofence_state = 'inside',
  geofence_outside_count = 0,
  geofence_last_alert = NULL
"""

COUNT_TABLES = [
    "sos_alerts",
    "medication_schedule_breaches",
    "patient_inactivity_logs",
    "patient_alerts",
    "patient_alert_relationships",
    "geofence_breach_events",
    "gps_locations",
    "patient_current_location",
    "patient_location_recent",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Delete alert and geofence-related records. "
            "Runs in preview mode unless --execute is supplied."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually execute the cleanup. Without this flag, only a preview is shown.",
    )
    parser.add_argument(
        "--include-location",
        action="store_true",
        help="Also delete location tables: gps_locations, patient_current_location, patient_location_recent.",
    )
    parser.add_argument(
        "--skip-user-geofence-reset",
        action="store_true",
        help="Do not reset geofence fields on users table.",
    )
    return parser.parse_args()


def get_count(db, table_name: str) -> int:
    result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
    return int(result.scalar() or 0)


def print_counts(db, title: str) -> None:
    print(f"\n{title}")
    for table in COUNT_TABLES:
        try:
            print(f"  - {table}: {get_count(db, table)}")
        except Exception as exc:
            print(f"  - {table}: <error: {exc}>")


def main() -> None:
    args = parse_args()

    steps = list(DELETE_STEPS)
    if args.include_location:
        steps.extend(OPTIONAL_LOCATION_STEPS)

    db = SessionLocal()
    try:
        print("Cleanup plan:")
        for step in steps:
            print(f"  - delete from {step.label}")
        if args.skip_user_geofence_reset:
            print("  - skip users geofence reset")
        else:
            print("  - reset users geofence fields")

        print_counts(db, "Current row counts:")

        if not args.execute:
            print("\nPreview only. Re-run with --execute to apply changes.")
            return

        for step in steps:
            db.execute(text(step.sql))

        if not args.skip_user_geofence_reset:
            db.execute(text(RESET_GEOFENCE_ON_USERS_SQL))

        db.commit()
        print("\nCleanup completed successfully.")
        print_counts(db, "Row counts after cleanup:")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
