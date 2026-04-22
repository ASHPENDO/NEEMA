"""add external_ref for idempotency

Revision ID: 84d8e216a9a1
Revises: fd3d7fa3c989
Create Date: 2026-04-22 08:29:53.861919

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# ---------------------------------------------------------
# Alembic identifiers
# ---------------------------------------------------------
revision: str = "84d8e216a9a1"
down_revision: Union[str, None] = "fd3d7fa3c989"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------
# Upgrade
# ---------------------------------------------------------
def upgrade() -> None:
    # 1. Add idempotency column
    op.add_column(
        "salesperson_earning_events",
        sa.Column("external_ref", sa.String(length=100), nullable=True),
    )

    # 2. Add index for fast lookup
    op.create_index(
        op.f("ix_salesperson_earning_events_external_ref"),
        "salesperson_earning_events",
        ["external_ref"],
        unique=False,
    )

    # 3. Add unique constraint (prevents duplicate payouts)
    op.create_unique_constraint(
        "uq_sales_external_ref",
        "salesperson_earning_events",
        ["external_ref"],
    )


# ---------------------------------------------------------
# Downgrade
# ---------------------------------------------------------
def downgrade() -> None:
    # 1. Drop unique constraint
    op.drop_constraint(
        "uq_sales_external_ref",
        "salesperson_earning_events",
        type_="unique",
    )

    # 2. Drop index
    op.drop_index(
        op.f("ix_salesperson_earning_events_external_ref"),
        table_name="salesperson_earning_events",
    )

    # 3. Drop column
    op.drop_column("salesperson_earning_events", "external_ref")