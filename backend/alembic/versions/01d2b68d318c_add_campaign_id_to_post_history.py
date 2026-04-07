"""add campaign_id to post_history

Revision ID: 01d2b68d318c
Revises: c0e0cbc82876
Create Date: 2026-04-07 21:05:59.983797

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01d2b68d318c'
down_revision: Union[str, None] = 'c0e0cbc82876'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1️⃣ Add column as nullable first (prevents crash)
    op.add_column(
        'post_history',
        sa.Column('campaign_id', sa.UUID(), nullable=True)
    )

    # 2️⃣ Populate existing rows with dummy UUIDs (prevents NULL issue)
    op.execute("UPDATE post_history SET campaign_id = gen_random_uuid()")

    # 3️⃣ Enforce NOT NULL safely
    op.alter_column(
        'post_history',
        'campaign_id',
        nullable=False
    )

    # 4️⃣ Create index
    op.create_index(
        op.f('ix_post_history_campaign_id'),
        'post_history',
        ['campaign_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_post_history_campaign_id'), table_name='post_history')
    op.drop_column('post_history', 'campaign_id')