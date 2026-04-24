"""remove subscription_status default

Revision ID: caf818626c8e
Revises: 7f0ac360788c
Create Date: 2026-04-24 08:44:59.130523

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'caf818626c8e'
down_revision: Union[str, None] = '7f0ac360788c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove the server default from subscription_status
    op.alter_column(
        'tenants',
        'subscription_status',
        existing_type=sa.String(length=30),
        server_default=None,
        existing_nullable=False
    )


def downgrade() -> None:
    # Restore the default (rollback safety)
    op.alter_column(
        'tenants',
        'subscription_status',
        existing_type=sa.String(length=30),
        server_default='trial',
        existing_nullable=False
    )