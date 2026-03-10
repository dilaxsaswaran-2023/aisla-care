"""Add agent tables: medication_schedules, patient_active_hours, agent_events

Revision ID: 2a3b4c5d
Revises: 1a2b3c4d
Create Date: 2026-03-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2a3b4c5d'
down_revision: Union[str, None] = '1a2b3c4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'medication_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('medicine_name', sa.String(), nullable=False),
        sa.Column('scheduled_time', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_medication_schedules_patient_id', 'medication_schedules', ['patient_id'])

    op.create_table(
        'patient_active_hours',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, unique=True, index=True),
        sa.Column('active_start', sa.String(), nullable=False),
        sa.Column('active_end', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_patient_active_hours_patient_id', 'patient_active_hours', ['patient_id'])

    op.create_table(
        'agent_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', sa.String(), nullable=False, index=True),
        sa.Column('patient_id', sa.String(), nullable=False, index=True),
        sa.Column('timestamp', sa.String(), nullable=False),
        sa.Column('result_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_agent_events_event_id', 'agent_events', ['event_id'])
    op.create_index('ix_agent_events_patient_id', 'agent_events', ['patient_id'])


def downgrade() -> None:
    op.drop_table('agent_events')
    op.drop_table('patient_active_hours')
    op.drop_table('medication_schedules')
