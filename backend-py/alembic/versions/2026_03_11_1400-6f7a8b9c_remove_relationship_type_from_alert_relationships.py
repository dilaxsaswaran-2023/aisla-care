"""Remove relationship_type from alert_relationships table

Revision ID: 6f7a8b9c
Revises: 5e6f7a8b
Create Date: 2026-03-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6f7a8b9c'
down_revision: Union[str, None] = '5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop relationship_type column
    op.drop_column('alert_relationships', 'relationship_type')


def downgrade() -> None:
    # Re-add relationship_type column (downgrade)
    from sqlalchemy.dialects import postgresql
    alert_rel_type_enum = postgresql.ENUM(
        'caregiver', 'family',
        name='alert_rel_type_enum',
        create_type=False
    )
    op.add_column('alert_relationships', 
                  sa.Column('relationship_type', alert_rel_type_enum, nullable=False))
