"""add payments ledger

Revision ID: f543681546b8
Revises: a1b605b1836f
Create Date: 2026-04-25 12:31:34.009470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'f543681546b8'
down_revision: Union[str, None] = 'a1b605b1836f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",

        # 🔑 PK
        sa.Column("id", sa.String(), primary_key=True),

        # 🔗 Relationship
        sa.Column("tenant_id", sa.String(), nullable=False),

        # 📌 MPESA identifiers
        sa.Column("checkout_request_id", sa.String(), nullable=False),
        sa.Column("merchant_request_id", sa.String(), nullable=True),
        sa.Column("mpesa_receipt_number", sa.String(), nullable=True),

        # 💰 Payment details
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="KES"),

        # 🔄 Status lifecycle
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("result_code", sa.Integer(), nullable=True),
        sa.Column("result_desc", sa.String(), nullable=True),

        # 🧾 Audit
        sa.Column("raw_callback", sa.JSON(), nullable=True),

        # ⏱️ Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),

        # 🔒 UNIQUE constraint (idempotency)
        sa.UniqueConstraint(
            "checkout_request_id",
            name="uq_payments_checkout_request_id"
        ),
    )

    # 🔍 Indexes (separate — safer)
    op.create_index("ix_payments_tenant_id", "payments", ["tenant_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_checkout_request_id", "payments", ["checkout_request_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_checkout_request_id", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_tenant_id", table_name="payments")
    op.drop_table("payments")