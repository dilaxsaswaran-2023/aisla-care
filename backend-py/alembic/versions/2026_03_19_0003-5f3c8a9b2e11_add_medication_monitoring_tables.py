"""add medication monitoring tables

Revision ID: 5f3c8a9b2e11
Revises: 2ab1e8f1d8a0
Create Date: 2026-03-17 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "5f3c8a9b2e11"
down_revision: Union[str, Sequence[str], None] = "2ab1e8f1d8a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medication_schedules_monitor",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("medication_schedule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medication_schedules.id"), nullable=False),
        sa.Column("scheduled_for_at", sa.DateTime(), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=False),
        sa.Column("taken_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("checked_at", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_medication_schedules_monitor_patient_id"), "medication_schedules_monitor", ["patient_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_monitor_medication_schedule_id"), "medication_schedules_monitor", ["medication_schedule_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_monitor_scheduled_for_at"), "medication_schedules_monitor", ["scheduled_for_at"], unique=False)
    op.create_index(op.f("ix_medication_schedules_monitor_due_at"), "medication_schedules_monitor", ["due_at"], unique=False)
    op.create_unique_constraint(
        "uq_medication_schedule_monitor_occurrence",
        "medication_schedules_monitor",
        ["patient_id", "medication_schedule_id", "scheduled_for_at"],
    )

    op.create_table(
        "medication_schedules_breach",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("medication_schedule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medication_schedules.id"), nullable=False),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medication_schedules_monitor.id"), nullable=False),
        sa.Column("breach_found_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("alerts.id"), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_medication_schedules_breach_patient_id"), "medication_schedules_breach", ["patient_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_breach_medication_schedule_id"), "medication_schedules_breach", ["medication_schedule_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_breach_monitor_id"), "medication_schedules_breach", ["monitor_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_breach_alert_id"), "medication_schedules_breach", ["alert_id"], unique=False)
    op.create_index(op.f("ix_medication_schedules_breach_breach_found_at"), "medication_schedules_breach", ["breach_found_at"], unique=False)
    op.create_unique_constraint("uq_medication_schedule_breach_monitor", "medication_schedules_breach", ["monitor_id"])


def downgrade() -> None:
    op.drop_constraint("uq_medication_schedule_breach_monitor", "medication_schedules_breach", type_="unique")
    op.drop_index(op.f("ix_medication_schedules_breach_breach_found_at"), table_name="medication_schedules_breach")
    op.drop_index(op.f("ix_medication_schedules_breach_alert_id"), table_name="medication_schedules_breach")
    op.drop_index(op.f("ix_medication_schedules_breach_monitor_id"), table_name="medication_schedules_breach")
    op.drop_index(op.f("ix_medication_schedules_breach_medication_schedule_id"), table_name="medication_schedules_breach")
    op.drop_index(op.f("ix_medication_schedules_breach_patient_id"), table_name="medication_schedules_breach")
    op.drop_table("medication_schedules_breach")

    op.drop_constraint("uq_medication_schedule_monitor_occurrence", "medication_schedules_monitor", type_="unique")
    op.drop_index(op.f("ix_medication_schedules_monitor_due_at"), table_name="medication_schedules_monitor")
    op.drop_index(op.f("ix_medication_schedules_monitor_scheduled_for_at"), table_name="medication_schedules_monitor")
    op.drop_index(op.f("ix_medication_schedules_monitor_medication_schedule_id"), table_name="medication_schedules_monitor")
    op.drop_index(op.f("ix_medication_schedules_monitor_patient_id"), table_name="medication_schedules_monitor")
    op.drop_table("medication_schedules_monitor")
