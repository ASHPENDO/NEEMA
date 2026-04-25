"""add unique constraint to payments checkout_request_id

Revision ID: dd0955c7a5f5
Revises: f543681546b8
Create Date: 2026-04-25 13:19:02.137546

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd0955c7a5f5'
down_revision: Union[str, None] = 'f543681546b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ Already handled in previous migration
    pass


def downgrade() -> None:
    pass