"""rename image_url to media_url in campaigns

Revision ID: d0c26d3abe6a
Revises: 8ea2870aefbf
Create Date: 2026-03-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0c26d3abe6a'
down_revision: Union[str, None] = '8ea2870aefbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new column
    op.add_column('campaigns', sa.Column('media_url', sa.Text(), nullable=True))

    # 2. Migrate existing data
    op.execute("""
        UPDATE campaigns
        SET media_url = image_url
    """)

    # 3. Drop old column
    op.drop_column('campaigns', 'image_url')


def downgrade() -> None:
    # 1. Recreate old column
    op.add_column('campaigns', sa.Column('image_url', sa.Text(), nullable=True))

    # 2. Restore data
    op.execute("""
        UPDATE campaigns
        SET image_url = media_url
    """)

    # 3. Drop new column
    op.drop_column('campaigns', 'media_url')