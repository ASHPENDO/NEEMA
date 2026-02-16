"""add salesperson attribution and earnings ledger

Revision ID: c700133bb19e
Revises: 6a659882e8ec
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c700133bb19e"
down_revision = "6a659882e8ec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------
    # 1) Add salesperson_profile_id to tenants
    # -----------------------------------------------------
    op.add_column(
        "tenants",
        sa.Column(
            "salesperson_profile_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_tenants_salesperson_profile_id",
        "tenants",
        ["salesperson_profile_id"],
    )

    op.create_foreign_key(
        "fk_tenants_salesperson_profile_id",
        source_table="tenants",
        referent_table="salesperson_profiles",
        local_cols=["salesperson_profile_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # -----------------------------------------------------
    # 2) Create salesperson_earning_events table
    # -----------------------------------------------------
    op.create_table(
        "salesperson_earning_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "salesperson_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "salesperson_profiles.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "tenants.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "event_type",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "currency",
            sa.String(length=10),
            nullable=False,
            server_default="KES",
        ),
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=False,
            server_default="MANUAL",
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_sales_earn_events_salesperson_occurred",
        "salesperson_earning_events",
        ["salesperson_profile_id", "occurred_at"],
    )

    op.create_index(
        "ix_sales_earn_events_tenant",
        "salesperson_earning_events",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sales_earn_events_tenant",
        table_name="salesperson_earning_events",
    )
    op.drop_index(
        "ix_sales_earn_events_salesperson_occurred",
        table_name="salesperson_earning_events",
    )
    op.drop_table("salesperson_earning_events")

    op.drop_constraint(
        "fk_tenants_salesperson_profile_id",
        "tenants",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_tenants_salesperson_profile_id",
        table_name="tenants",
    )
    op.drop_column("tenants", "salesperson_profile_id")
