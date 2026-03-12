"""add is_read and is_added_to_emergency fields

Revision ID: 9a0b1c2d
Revises: 8h9i0j1k
Create Date: 2026-03-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a0b1c2d"
down_revision: Union[str, None] = "8h9i0j1k"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # alerts table
    op.add_column("alerts", sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("alerts", sa.Column("is_added_to_emergency", sa.Boolean(), nullable=False, server_default="false"))

    # patient_alerts table
    op.add_column("patient_alerts", sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("patient_alerts", "is_read")
    op.drop_column("alerts", "is_added_to_emergency")
    op.drop_column("alerts", "is_read")
