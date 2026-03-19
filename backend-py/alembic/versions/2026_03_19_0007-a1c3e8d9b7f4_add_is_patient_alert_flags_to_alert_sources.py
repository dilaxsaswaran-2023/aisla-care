"""add is_patient_alert flags to alert source tables

Revision ID: a1c3e8d9b7f4
Revises: f81e2d1c9a77
Create Date: 2026-03-19 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c3e8d9b7f4"
down_revision: Union[str, Sequence[str], None] = "f81e2d1c9a77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names(schema="public")


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name, schema="public"))


def _add_is_patient_alert(inspector: sa.Inspector, table_name: str) -> None:
    if _table_exists(inspector, table_name) and not _column_exists(inspector, table_name, "is_patient_alert"):
        op.add_column(
            table_name,
            sa.Column(
                "is_patient_alert",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def _drop_is_patient_alert(inspector: sa.Inspector, table_name: str) -> None:
    if _table_exists(inspector, table_name) and _column_exists(inspector, table_name, "is_patient_alert"):
        op.drop_column(table_name, "is_patient_alert")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _add_is_patient_alert(inspector, "sos_alerts")
    _add_is_patient_alert(inspector, "geofence_breach_events")
    _add_is_patient_alert(inspector, "medication_schedule_breaches")
    _add_is_patient_alert(inspector, "patient_inactivity_logs")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _drop_is_patient_alert(inspector, "patient_inactivity_logs")
    _drop_is_patient_alert(inspector, "medication_schedule_breaches")
    _drop_is_patient_alert(inspector, "geofence_breach_events")
    _drop_is_patient_alert(inspector, "sos_alerts")
