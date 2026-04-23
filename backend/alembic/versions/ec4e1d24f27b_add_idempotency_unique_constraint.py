"""add idempotency unique constraint

Revision ID: ec4e1d24f27b
Revises: 84d8e216a9a1
Create Date: 2026-04-23 05:06:50.292961

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec4e1d24f27b'
down_revision: Union[str, None] = '84d8e216a9a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add external_ref column
    op.add_column(
        "salesperson_earning_events",
        sa.Column("external_ref", sa.String(length=100), nullable=True),
    )

    # 2. Add unique constraint for idempotency
    op.create_unique_constraint(
        "uq_salesperson_earning_external_ref",
        "salesperson_earning_events",
        ["external_ref"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_salesperson_earning_external_ref",
        "salesperson_earning_events",
        type_="unique",
    )

    op.drop_column("salesperson_earning_events", "external_ref")