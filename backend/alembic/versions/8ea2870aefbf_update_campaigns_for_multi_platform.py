"""update campaigns for multi-platform

Revision ID: 8ea2870aefbf
Revises: 47c3ec8dcac3
Create Date: 2026-03-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8ea2870aefbf'
down_revision: Union[str, None] = '47c3ec8dcac3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns as nullable first (SAFE)
    op.add_column('campaigns', sa.Column('platforms', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('campaigns', sa.Column('page_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('campaigns', sa.Column('status', sa.String(), nullable=True))

    # 2. Migrate existing data
    op.execute("""
        UPDATE campaigns
        SET 
            platforms = json_build_array(platform),
            page_ids = CASE 
                WHEN page_id IS NOT NULL THEN json_build_array(page_id)
                ELSE '[]'::json
            END,
            status = 'scheduled'
    """)

    # 3. Enforce NOT NULL after data migration
    op.alter_column('campaigns', 'platforms', nullable=False)
    op.alter_column('campaigns', 'page_ids', nullable=False)

    # 4. Drop old columns
    op.drop_column('campaigns', 'platform')
    op.drop_column('campaigns', 'page_id')


def downgrade() -> None:
    # 1. Recreate old columns
    op.add_column('campaigns', sa.Column('platform', sa.String(), nullable=True))
    op.add_column('campaigns', sa.Column('page_id', sa.String(), nullable=True))

    # 2. Restore data
    op.execute("""
        UPDATE campaigns
        SET 
            platform = platforms->>0,
            page_id = page_ids->>0
    """)

    # 3. Drop new columns
    op.drop_column('campaigns', 'status')
    op.drop_column('campaigns', 'page_ids')
    op.drop_column('campaigns', 'platforms')