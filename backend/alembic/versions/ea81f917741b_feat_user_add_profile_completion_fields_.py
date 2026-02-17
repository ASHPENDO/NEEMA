"""feat(user): add profile completion fields (phone_e164, country)

Revision ID: 3f2a9d8c7b11
Revises: 9b7846119128
Create Date: <AUTO>
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3f2a9d8c7b11"
down_revision: Union[str, None] = "9b7846119128"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add canonical profile fields (nullable; profile completion is derived in code)
    op.add_column("users", sa.Column("phone_e164", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(length=2), nullable=True))

    # Optional: lightweight index for lookups/analytics; safe and non-unique
    op.create_index("ix_users_phone_e164", "users", ["phone_e164"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_phone_e164", table_name="users")
    op.drop_column("users", "country")
    op.drop_column("users", "phone_e164")
