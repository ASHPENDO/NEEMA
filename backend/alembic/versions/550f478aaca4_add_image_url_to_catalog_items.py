"""add image_url to catalog_items

Revision ID: 8b1d9f2e6c31
Revises: 4ac46f8005b9
Create Date: 2026-03-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b1d9f2e6c31"
down_revision: Union[str, None] = "4ac46f8005b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "catalog_items",
        sa.Column("image_url", sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("catalog_items", "image_url")