"""restructure alert tables for sos-first model

Revision ID: f81e2d1c9a77
Revises: b4d9f7a8c1e2
Create Date: 2026-03-19 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f81e2d1c9a77"
down_revision: Union[str, Sequence[str], None] = "b4d9f7a8c1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names(schema="public")


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name, schema="public"))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1) Rename budii_alert_relationships -> patient_alert_relationships
    has_old_relationships = _table_exists(inspector, "budii_alert_relationships")
    has_new_relationships = _table_exists(inspector, "patient_alert_relationships")

    if has_old_relationships and not has_new_relationships:
        op.rename_table("budii_alert_relationships", "patient_alert_relationships")
        op.execute(
            "ALTER INDEX IF EXISTS ix_budii_alert_relationships_patient_alert_id "
            "RENAME TO ix_patient_alert_relationships_patient_alert_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_budii_alert_relationships_family_id "
            "RENAME TO ix_patient_alert_relationships_family_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_budii_alert_relationships_caregiver_id "
            "RENAME TO ix_patient_alert_relationships_caregiver_id"
        )
    elif has_old_relationships and has_new_relationships:
        # If both tables exist (partially-migrated DB), merge old rows then remove legacy table.
        op.execute(
            """
            INSERT INTO patient_alert_relationships (
                id, patient_alert_id, caregiver_id, family_id, created_at, updated_at
            )
            SELECT b.id, b.patient_alert_id, b.caregiver_id, b.family_id, b.created_at, b.updated_at
            FROM budii_alert_relationships b
            LEFT JOIN patient_alert_relationships p ON p.id = b.id
            WHERE p.id IS NULL
            """
        )
        op.drop_table("budii_alert_relationships")

    # 2) Drop legacy alert linkage from medication breaches and rename table
    has_old_medication_table = _table_exists(inspector, "medication_schedules_breach")
    has_new_medication_table = _table_exists(inspector, "medication_schedule_breaches")

    if has_old_medication_table and not has_new_medication_table:
        fks = inspector.get_foreign_keys("medication_schedules_breach", schema="public")
        for fk in fks:
            if fk.get("constrained_columns") == ["alert_id"] and fk.get("name"):
                op.drop_constraint(fk["name"], "medication_schedules_breach", type_="foreignkey")

        if _column_exists(inspector, "medication_schedules_breach", "alert_id"):
            op.execute("DROP INDEX IF EXISTS ix_medication_schedules_breach_alert_id")
            op.drop_column("medication_schedules_breach", "alert_id")

        op.rename_table("medication_schedules_breach", "medication_schedule_breaches")
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedules_breach_patient_id "
            "RENAME TO ix_medication_schedule_breaches_patient_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedules_breach_medication_schedule_id "
            "RENAME TO ix_medication_schedule_breaches_medication_schedule_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedules_breach_monitor_id "
            "RENAME TO ix_medication_schedule_breaches_monitor_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedules_breach_breach_found_at "
            "RENAME TO ix_medication_schedule_breaches_breach_found_at"
        )
    elif has_old_medication_table and has_new_medication_table:
        # If both tables exist, preserve data by moving unique rows and remove legacy table.
        op.execute(
            """
            INSERT INTO medication_schedule_breaches (
                id, patient_id, medication_schedule_id, monitor_id, breach_found_at,
                created_by, reason, status, created_at, updated_at
            )
            SELECT
                old.id, old.patient_id, old.medication_schedule_id, old.monitor_id, old.breach_found_at,
                old.created_by, old.reason, old.status, old.created_at, old.updated_at
            FROM medication_schedules_breach old
            LEFT JOIN medication_schedule_breaches new ON new.id = old.id
            WHERE new.id IS NULL
            """
        )
        op.drop_table("medication_schedules_breach")

    # 3) Remove legacy alert tables
    if _table_exists(inspector, "alert_relationships"):
        op.drop_table("alert_relationships")

    if _table_exists(inspector, "alerts"):
        op.drop_table("alerts")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1) Recreate legacy alerts table if needed
    if not _table_exists(inspector, "alerts"):
        op.create_table(
            "alerts",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "alert_type",
                sa.Enum("sos", "fall", "geofence", "inactivity", "health", "medication", name="alert_type_enum"),
                nullable=False,
            ),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("priority", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("voice_transcription", sa.String(), nullable=True),
            sa.Column("latitude", sa.Float(), nullable=True),
            sa.Column("longitude", sa.Float(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_added_to_emergency", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_alerts_patient_id", "alerts", ["patient_id"], unique=False)
        op.create_index("ix_alerts_status", "alerts", ["status"], unique=False)

    # 2) Recreate legacy alert relationships table if needed
    if not _table_exists(inspector, "alert_relationships"):
        op.create_table(
            "alert_relationships",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
            sa.ForeignKeyConstraint(["caregiver_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["family_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_alert_relationships_alert_id", "alert_relationships", ["alert_id"], unique=False)
        op.create_index("ix_alert_relationships_caregiver_id", "alert_relationships", ["caregiver_id"], unique=False)
        op.create_index("ix_alert_relationships_family_id", "alert_relationships", ["family_id"], unique=False)

    # 3) Rename medication_schedule_breaches back and restore alert_id
    inspector = sa.inspect(op.get_bind())
    if _table_exists(inspector, "medication_schedule_breaches"):
        op.rename_table("medication_schedule_breaches", "medication_schedules_breach")
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedule_breaches_patient_id "
            "RENAME TO ix_medication_schedules_breach_patient_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedule_breaches_medication_schedule_id "
            "RENAME TO ix_medication_schedules_breach_medication_schedule_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedule_breaches_monitor_id "
            "RENAME TO ix_medication_schedules_breach_monitor_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_medication_schedule_breaches_breach_found_at "
            "RENAME TO ix_medication_schedules_breach_breach_found_at"
        )

        if not _column_exists(inspector, "medication_schedules_breach", "alert_id"):
            op.add_column("medication_schedules_breach", sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=True))
            op.create_index("ix_medication_schedules_breach_alert_id", "medication_schedules_breach", ["alert_id"], unique=False)
            op.create_foreign_key(
                "medication_schedules_breach_alert_id_fkey",
                "medication_schedules_breach",
                "alerts",
                ["alert_id"],
                ["id"],
            )

    # 4) Rename patient_alert_relationships back
    inspector = sa.inspect(op.get_bind())
    if _table_exists(inspector, "patient_alert_relationships"):
        op.rename_table("patient_alert_relationships", "budii_alert_relationships")
        op.execute(
            "ALTER INDEX IF EXISTS ix_patient_alert_relationships_patient_alert_id "
            "RENAME TO ix_budii_alert_relationships_patient_alert_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_patient_alert_relationships_family_id "
            "RENAME TO ix_budii_alert_relationships_family_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_patient_alert_relationships_caregiver_id "
            "RENAME TO ix_budii_alert_relationships_caregiver_id"
        )
