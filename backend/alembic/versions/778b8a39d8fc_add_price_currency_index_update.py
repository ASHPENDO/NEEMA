"""add price_currency index/update

Revision ID: 778b8a39d8fc
Revises: b94eb12e4c7e
Create Date: 2026-04-10 15:15:55.382602

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '778b8a39d8fc'
down_revision: Union[str, None] = 'b94eb12e4c7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add index on price_currency for faster filtering and analytics.

    Safe for repeated runs (PostgreSQL).
    """
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE indexname = 'ix_catalog_items_price_currency'
            ) THEN
                CREATE INDEX ix_catalog_items_price_currency
                ON catalog_items (price_currency);
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    """
    Remove index safely.
    """
    op.execute(
        """
        DROP INDEX IF EXISTS ix_catalog_items_price_currency;
        """
    )