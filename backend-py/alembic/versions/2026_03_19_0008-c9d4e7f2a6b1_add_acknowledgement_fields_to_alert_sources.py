"""add acknowledgement fields to alert source tables

Revision ID: c9d4e7f2a6b1
Revises: a1c3e8d9b7f4
Create Date: 2026-03-19 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9d4e7f2a6b1"
down_revision: Union[str, Sequence[str], None] = "a1c3e8d9b7f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names(schema="public")


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name, schema="public"))


def _add_ack_columns(inspector: sa.Inspector, table_name: str) -> None:
    if not _table_exists(inspector, table_name):
        return

    if not _column_exists(inspector, table_name, "is_acknowledged"):
        op.add_column(
            table_name,
            sa.Column("is_acknowledged", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    if not _column_exists(inspector, table_name, "acknowledged_via"):
        op.add_column(
            table_name,
            sa.Column("acknowledged_via", sa.String(), nullable=True),
        )


def _drop_ack_columns(inspector: sa.Inspector, table_name: str) -> None:
    if not _table_exists(inspector, table_name):
        return

    if _column_exists(inspector, table_name, "acknowledged_via"):
        op.drop_column(table_name, "acknowledged_via")

    if _column_exists(inspector, table_name, "is_acknowledged"):
        op.drop_column(table_name, "is_acknowledged")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _add_ack_columns(inspector, "sos_alerts")
    _add_ack_columns(inspector, "patient_alerts")
    _add_ack_columns(inspector, "geofence_breach_events")
    _add_ack_columns(inspector, "medication_schedule_breaches")
    _add_ack_columns(inspector, "patient_inactivity_logs")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _drop_ack_columns(inspector, "patient_inactivity_logs")
    _drop_ack_columns(inspector, "medication_schedule_breaches")
    _drop_ack_columns(inspector, "geofence_breach_events")
    _drop_ack_columns(inspector, "patient_alerts")
    _drop_ack_columns(inspector, "sos_alerts")
