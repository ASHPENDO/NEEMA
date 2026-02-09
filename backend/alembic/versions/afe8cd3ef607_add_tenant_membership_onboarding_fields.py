"""add tenant membership onboarding fields

Revision ID: afe8cd3ef607
Revises: 90fa6266762c
Create Date: 2026-02-09
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "afe8cd3ef607"
down_revision = "90fa6266762c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_memberships",
        sa.Column(
            "accepted_terms",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "tenant_memberships",
        sa.Column("notifications_opt_in", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "tenant_memberships",
        sa.Column("referral_code", sa.String(length=64), nullable=True),
    )

    # remove the default after existing rows are backfilled
    op.alter_column("tenant_memberships", "accepted_terms", server_default=None)


def downgrade() -> None:
    op.drop_column("tenant_memberships", "referral_code")
    op.drop_column("tenant_memberships", "notifications_opt_in")
    op.drop_column("tenant_memberships", "accepted_terms")
