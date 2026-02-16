"""fix: restore earning events table + pending invite indexes

Revision ID: 9b7846119128
Revises: 6ed7caee49fb
Create Date: <AUTO>
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "9b7846119128"
down_revision: Union[str, None] = "6ed7caee49fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_PLATFORM_PENDING = "uq_platform_invitations_pending_email"
INDEX_TENANT_PENDING = "uq_tenant_invites_pending_tenant_email"


def upgrade() -> None:
    # ------------------------------------------------------------
    # 1) Restore salesperson_earning_events (dropped incorrectly)
    # ------------------------------------------------------------
    op.create_table(
        "salesperson_earning_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("salesperson_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default=sa.text("'KES'")),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default=sa.text("'MANUAL'")),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["salesperson_profile_id"],
            ["salesperson_profiles.id"],
            ondelete="CASCADE",
            name="salesperson_earning_events_salesperson_profile_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="SET NULL",
            name="salesperson_earning_events_tenant_id_fkey",
        ),
    )

    op.create_index(
        "ix_sales_earn_events_salesperson_occurred",
        "salesperson_earning_events",
        ["salesperson_profile_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_sales_earn_events_tenant",
        "salesperson_earning_events",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_earn_events_type",
        "salesperson_earning_events",
        ["event_type"],
        unique=False,
    )

    # ------------------------------------------------------------
    # 2) Restore partial unique indexes (dropped incorrectly)
    #    These are created via SQL in earlier migrations, so
    #    Alembic autogenerate won't "see" them in models.
    # ------------------------------------------------------------

    # platform_invitations: unique pending invitation per email (case-insensitive)
    op.execute(
        f"""
        CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_PLATFORM_PENDING}
        ON platform_invitations (lower(email))
        WHERE accepted_at IS NULL;
        """
    )

    # tenant_invitations: unique pending invitation per tenant+email
    op.create_index(
        INDEX_TENANT_PENDING,
        "tenant_invitations",
        ["tenant_id", "email"],
        unique=True,
        postgresql_where=text("accepted_at IS NULL"),
    )


def downgrade() -> None:
    # drop restored tenant pending index
    op.drop_index(INDEX_TENANT_PENDING, table_name="tenant_invitations")

    # drop restored platform pending index
    op.execute(f"DROP INDEX IF EXISTS {INDEX_PLATFORM_PENDING};")

    # drop earning events indexes + table
    op.drop_index("ix_sales_earn_events_type", table_name="salesperson_earning_events")
    op.drop_index("ix_sales_earn_events_tenant", table_name="salesperson_earning_events")
    op.drop_index("ix_sales_earn_events_salesperson_occurred", table_name="salesperson_earning_events")
    op.drop_table("salesperson_earning_events")
