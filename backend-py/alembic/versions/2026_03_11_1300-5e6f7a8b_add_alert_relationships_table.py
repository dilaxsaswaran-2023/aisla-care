"""Add alert_relationships table

Revision ID: 5e6f7a8b
Revises: 4c5d6e7f
Create Date: 2026-03-11 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e6f7a8b'
down_revision: Union[str, None] = '4c5d6e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type for relationship type
    alert_rel_type_enum = postgresql.ENUM(
        'caregiver', 'family',
        name='alert_rel_type_enum',
        create_type=False
    )
    alert_rel_type_enum.create(op.get_bind(), checkfirst=True)

    # Create alert_relationships table
    op.create_table(
        'alert_relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('caregiver_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('relationship_type', alert_rel_type_enum, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ),
        sa.ForeignKeyConstraint(['caregiver_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['family_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_relationships_alert_id'), 'alert_relationships', ['alert_id'], unique=False)
    op.create_index(op.f('ix_alert_relationships_caregiver_id'), 'alert_relationships', ['caregiver_id'], unique=False)
    op.create_index(op.f('ix_alert_relationships_family_id'), 'alert_relationships', ['family_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_alert_relationships_family_id'), table_name='alert_relationships')
    op.drop_index(op.f('ix_alert_relationships_caregiver_id'), table_name='alert_relationships')
    op.drop_index(op.f('ix_alert_relationships_alert_id'), table_name='alert_relationships')
    op.drop_table('alert_relationships')
