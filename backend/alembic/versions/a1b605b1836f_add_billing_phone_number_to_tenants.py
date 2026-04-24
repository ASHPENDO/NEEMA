"""add billing_phone_number to tenants

Revision ID: a1b605b1836f
Revises: caf818626c8e
Create Date: 2026-04-24 14:16:04.114890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b605b1836f'
down_revision: Union[str, None] = 'caf818626c8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('billing_phone_number', sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'billing_phone_number')