"""add caregiver_ids to users

Revision ID: 2ab1e8f1d8a0
Revises: dc66ef445e1d
Create Date: 2026-03-17 11:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2ab1e8f1d8a0'
down_revision: Union[str, Sequence[str], None] = 'dc66ef445e1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('caregiver_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
    )

    # Backfill caregiver_ids from existing caregiver_id where available.
    op.execute(
        """
        UPDATE users
        SET caregiver_ids = ARRAY[caregiver_id]
        WHERE role = 'patient' AND caregiver_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column('users', 'caregiver_ids')
