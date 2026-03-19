"""extend audit logs for global event tracking

Revision ID: b4d9f7a8c1e2
Revises: 7c1d2f8a4b90
Create Date: 2026-03-18 12:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "b4d9f7a8c1e2"
down_revision = "7c1d2f8a4b90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("audit_logs", sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("audit_logs", sa.Column("event_type", sa.String(), nullable=True))
    op.add_column("audit_logs", sa.Column("source", sa.String(), nullable=True))

    op.create_index("ix_audit_logs_patient_id", "audit_logs", ["patient_id"], unique=False)
    op.create_index("ix_audit_logs_caregiver_id", "audit_logs", ["caregiver_id"], unique=False)
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"], unique=False)
    op.create_index("ix_audit_logs_source", "audit_logs", ["source"], unique=False)

    op.create_foreign_key(
        "fk_audit_logs_patient_id_users",
        "audit_logs",
        "users",
        ["patient_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_audit_logs_caregiver_id_users",
        "audit_logs",
        "users",
        ["caregiver_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_audit_logs_caregiver_id_users", "audit_logs", type_="foreignkey")
    op.drop_constraint("fk_audit_logs_patient_id_users", "audit_logs", type_="foreignkey")

    op.drop_index("ix_audit_logs_source", table_name="audit_logs")
    op.drop_index("ix_audit_logs_event_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_caregiver_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_patient_id", table_name="audit_logs")

    op.drop_column("audit_logs", "source")
    op.drop_column("audit_logs", "event_type")
    op.drop_column("audit_logs", "caregiver_id")
    op.drop_column("audit_logs", "patient_id")
