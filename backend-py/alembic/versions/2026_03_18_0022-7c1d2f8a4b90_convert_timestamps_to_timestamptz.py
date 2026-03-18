"""convert timestamps to timestamptz

Revision ID: 7c1d2f8a4b90
Revises: 5f3c8a9b2e11
Create Date: 2026-03-18 00:22:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "7c1d2f8a4b90"
down_revision = "5f3c8a9b2e11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE r RECORD;
        BEGIN
            FOR r IN
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND data_type = 'timestamp without time zone'
                  AND table_name <> 'alembic_version'
            LOOP
                EXECUTE format(
                    'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMP WITH TIME ZONE USING %I AT TIME ZONE ''UTC''',
                    r.table_name,
                    r.column_name,
                    r.column_name
                );
            END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE r RECORD;
        BEGIN
            FOR r IN
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND data_type = 'timestamp with time zone'
                  AND table_name <> 'alembic_version'
            LOOP
                EXECUTE format(
                    'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMP WITHOUT TIME ZONE USING %I AT TIME ZONE ''UTC''',
                    r.table_name,
                    r.column_name,
                    r.column_name
                );
            END LOOP;
        END $$;
        """
    )
