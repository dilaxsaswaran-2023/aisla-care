"""Add patient_alerts table

Revision ID: 8h9i0j1k
Revises: 7g8h9i0j
Create Date: 2026-03-11 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8h9i0j1k'
down_revision: Union[str, None] = '7g8h9i0j'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create patient_alerts table
    op.create_table(
        'patient_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('case', sa.String(), nullable=True),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('source', sa.String(), nullable=False, server_default='budii'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('ix_patient_alerts_patient_id', 'patient_alerts', ['patient_id'])
    op.create_index('ix_patient_alerts_event_id', 'patient_alerts', ['event_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_patient_alerts_event_id', table_name='patient_alerts')
    op.drop_index('ix_patient_alerts_patient_id', table_name='patient_alerts')

    # Drop table
    op.drop_table('patient_alerts')
