"""Add patient location tables

Revision ID: 7g8h9i0j
Revises: 6f7a8b9c
Create Date: 2026-03-11 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '7g8h9i0j'
down_revision = '6f7a8b9c'
branch_labels = None
depends_on = None


def upgrade():
    # Create patient_current_location table
    op.create_table(
        'patient_current_location',
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('patient_id')
    )

    # Create patient_location_recent table
    op.create_table(
        'patient_location_recent',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index(
        'ix_patient_location_recent_patient_captured',
        'patient_location_recent',
        ['patient_id', 'captured_at'],
        postgresql_using='btree'
    )

    # Create unique constraint
    op.create_unique_constraint(
        'uq_patient_location_recent_unique',
        'patient_location_recent',
        ['patient_id', 'captured_at']
    )


def downgrade():
    op.drop_constraint('uq_patient_location_recent_unique', 'patient_location_recent', type_='unique')
    op.drop_index('ix_patient_location_recent_patient_captured', table_name='patient_location_recent')
    op.drop_table('patient_location_recent')
    op.drop_table('patient_current_location')
