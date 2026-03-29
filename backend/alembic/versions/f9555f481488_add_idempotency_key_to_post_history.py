"""add idempotency key to post_history

Revision ID: f9555f481488
Revises: 4a7a206cbc61
Create Date: 2026-03-29 17:48:10.908006

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9555f481488'
down_revision: Union[str, None] = '4a7a206cbc61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
