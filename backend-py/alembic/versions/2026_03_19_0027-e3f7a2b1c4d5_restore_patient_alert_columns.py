"""restore missing patient_alerts columns used by runtime

Revision ID: e3f7a2b1c4d5
Revises: c9d4e7f2a6b1
Create Date: 2026-03-19 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e3f7a2b1c4d5"
down_revision: Union[str, Sequence[str], None] = "c9d4e7f2a6b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names(schema="public")


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name, schema="public"))


def _add_required_text_column(table_name: str, column_name: str, default_value: str) -> None:
    op.add_column(
        table_name,
        sa.Column(column_name, sa.String(), nullable=True, server_default=sa.text(f"'{default_value}'")),
    )
    op.execute(
        sa.text(
            f"UPDATE {table_name} SET {column_name} = :default_value WHERE {column_name} IS NULL"
        ).bindparams(default_value=default_value)
    )
    op.alter_column(table_name, column_name, nullable=False)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not _table_exists(inspector, "patient_alerts"):
        return

    if not _column_exists(inspector, "patient_alerts", "case"):
        op.add_column("patient_alerts", sa.Column("case", sa.String(), nullable=True))

    if not _column_exists(inspector, "patient_alerts", "title"):
        _add_required_text_column("patient_alerts", "title", "Alert")

    if not _column_exists(inspector, "patient_alerts", "message"):
        op.add_column("patient_alerts", sa.Column("message", sa.String(), nullable=True))

    if not _column_exists(inspector, "patient_alerts", "status"):
        _add_required_text_column("patient_alerts", "status", "active")

    if not _column_exists(inspector, "patient_alerts", "source"):
        _add_required_text_column("patient_alerts", "source", "monitor")


def downgrade() -> None:
    # Intentionally no-op to avoid destructive data loss on rollback.
    pass
