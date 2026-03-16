"""add_created_by_to_medication_schedules

Revision ID: 79bd0b9fee67
Revises: 354f173625c1
Create Date: 2026-03-16 17:15:09.327736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79bd0b9fee67'
down_revision: Union[str, Sequence[str], None] = '354f173625c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add created_by column to medication_schedules table
    op.add_column('medication_schedules', sa.Column('created_by', sa.UUID(), nullable=False))
    op.create_index(op.f('ix_medication_schedules_created_by'), 'medication_schedules', ['created_by'], unique=False)
    op.create_foreign_key('fk_medication_schedules_created_by_users', 'medication_schedules', 'users', ['created_by'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove created_by column from medication_schedules table
    op.drop_constraint('fk_medication_schedules_created_by_users', 'medication_schedules', type_='foreignkey')
    op.drop_index(op.f('ix_medication_schedules_created_by'), table_name='medication_schedules')
    op.drop_column('medication_schedules', 'created_by')
