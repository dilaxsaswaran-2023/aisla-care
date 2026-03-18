import argparse
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI = PROJECT_ROOT / "alembic.ini"
SEEDER_PATH = PROJECT_ROOT / "app" / "seeder.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Drop all tables by downgrading to Alembic base, recreate schema at head, "
            "then run app/seeder.py."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually run reset + recreate + seed. Without this flag, only a preview is shown.",
    )
    return parser.parse_args()


def run_step(label: str, cmd: list[str]) -> None:
    print(f"\n[{label}] {' '.join(cmd)}")
    subprocess.run(cmd, cwd=PROJECT_ROOT, check=True)


def main() -> None:
    args = parse_args()

    python_exec = sys.executable
    downgrade_cmd = [python_exec, "-m", "alembic", "-c", str(ALEMBIC_INI), "downgrade", "base"]
    upgrade_cmd = [python_exec, "-m", "alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"]
    seed_cmd = [python_exec, str(SEEDER_PATH)]

    print("Reset plan:")
    print("  1. Drop all schema objects via Alembic downgrade base")
    print("  2. Recreate schema via Alembic upgrade head")
    print("  3. Run seeder script")

    if not args.execute:
        print("\nPreview only. Re-run with --execute to apply changes.")
        print("\nCommand:")
        print(f"  {python_exec} scripts/reset_db_and_seed.py --execute")
        return

    try:
        run_step("DOWNGRADE", downgrade_cmd)
        run_step("UPGRADE", upgrade_cmd)
        run_step("SEED", seed_cmd)
        print("\nDatabase reset and seeding completed successfully.")
    except subprocess.CalledProcessError as exc:
        print(f"\nFailed at step with exit code {exc.returncode}.")
        raise


if __name__ == "__main__":
    main()
