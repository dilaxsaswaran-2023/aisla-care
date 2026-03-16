"""add_urgency_and_grace_period_to_medication_schedules

Revision ID: bf29c4d1e2a9
Revises: 79bd0b9fee67
Create Date: 2026-03-16 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf29c4d1e2a9'
down_revision: Union[str, Sequence[str], None] = '79bd0b9fee67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'medication_schedules',
        sa.Column('urgency_level', sa.String(), nullable=False, server_default='medium'),
    )
    op.add_column(
        'medication_schedules',
        sa.Column('grace_period_minutes', sa.Integer(), nullable=False, server_default='60'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('medication_schedules', 'grace_period_minutes')
    op.drop_column('medication_schedules', 'urgency_level')
