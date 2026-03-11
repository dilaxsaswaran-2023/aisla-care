"""Add notifications table

Revision ID: 3b4c5d6e
Revises: 2a3b4c5d
Create Date: 2026-03-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3b4c5d6e'
down_revision: Union[str, None] = '2a3b4c5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums using raw SQL so IF NOT EXISTS is honoured by PostgreSQL
    op.execute("DO $$ BEGIN CREATE TYPE notification_channel_enum AS ENUM ('sms', 'whatsapp'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE notification_status_enum AS ENUM ('sent', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Use postgresql.ENUM with create_type=False so SQLAlchemy does NOT try to
    # recreate the types during table creation (they already exist).
    channel_col_type = postgresql.ENUM('sms', 'whatsapp', name='notification_channel_enum', create_type=False)
    status_col_type = postgresql.ENUM('sent', 'failed', name='notification_status_enum', create_type=False)

    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('alert_case', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('recipient_user_id', sa.String(), nullable=True),
        sa.Column('recipient_phone', sa.String(), nullable=False),
        sa.Column('channel', channel_col_type, nullable=False, server_default='sms'),
        sa.Column('status', status_col_type, nullable=False, server_default='sent'),
        sa.Column('twilio_sid', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('agent_event_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_notifications_patient_id', 'notifications', ['patient_id'])
    op.create_index('ix_notifications_agent_event_id', 'notifications', ['agent_event_id'])


def downgrade() -> None:
    op.drop_index('ix_notifications_agent_event_id', table_name='notifications')
    op.drop_index('ix_notifications_patient_id', table_name='notifications')
    op.drop_table('notifications')
    op.execute("DROP TYPE IF EXISTS notification_channel_enum")
    op.execute("DROP TYPE IF EXISTS notification_status_enum")
