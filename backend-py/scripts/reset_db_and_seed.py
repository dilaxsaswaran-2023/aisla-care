import argparse
import sys
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Import models package so all model metadata is registered on Base.
from app import models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.seeder import seed_super_admin


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Drop all tables using SQLAlchemy metadata, recreate schema, "
            "then run app/seeder.py."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually run reset + recreate + seed. Without this flag, only a preview is shown.",
    )
    return parser.parse_args()


def drop_and_recreate_tables() -> None:
    print("\n[RESET] Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("[RESET] Creating all tables...")
    Base.metadata.create_all(bind=engine)


def run_seed() -> None:
    print("\n[SEED] Running super-admin seed...")
    db = SessionLocal()
    try:
        seed_super_admin(db)
    finally:
        db.close()


def main() -> None:
    args = parse_args()

    print("Reset plan:")
    print("  1. Drop all tables via SQLAlchemy Base.metadata.drop_all")
    print("  2. Recreate all tables via SQLAlchemy Base.metadata.create_all")
    print("  3. Run seeder function")

    if not args.execute:
        print("\nPreview only. Re-run with --execute to apply changes.")
        print("\nCommand:")
        print(f"  {sys.executable} scripts/reset_db_and_seed.py --execute")
        return

    try:
        drop_and_recreate_tables()
        run_seed()
        print("\nDatabase reset and seeding completed successfully.")
    except SQLAlchemyError as exc:
        print(f"\nDatabase operation failed: {exc}")
        raise
    except Exception as exc:
        print(f"\nReset/seed failed: {exc}")
        raise


if __name__ == "__main__":
    main()
