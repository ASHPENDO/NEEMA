"""add multi-product support to campaigns

Revision ID: b94eb12e4c7e
Revises: 01d2b68d318c
Create Date: 2026-04-10 10:12:21.213124
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b94eb12e4c7e"
down_revision: Union[str, None] = "01d2b68d318c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==============================
    # ADD MULTI-PRODUCT SUPPORT
    # ==============================
    op.add_column(
        "campaigns",
        sa.Column(
            "product_ids",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # ==============================
    # ADD MULTI-MEDIA SUPPORT
    # ==============================
    op.add_column(
        "campaigns",
        sa.Column(
            "media_urls",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # ==============================
    # REMOVE MULTI-MEDIA SUPPORT
    # ==============================
    op.drop_column("campaigns", "media_urls")

    # ==============================
    # REMOVE MULTI-PRODUCT SUPPORT
    # ==============================
    op.drop_column("campaigns", "product_ids")