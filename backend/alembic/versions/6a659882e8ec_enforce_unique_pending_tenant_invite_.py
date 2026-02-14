"""enforce unique pending tenant invite per tenant email

Revision ID: 6a659882e8ec
Revises: 85138c4a60e0
Create Date: 2026-02-14
"""

from alembic import op
from sqlalchemy import text  # ✅ FIX: use SQLAlchemy text()

# revision identifiers, used by Alembic.
revision = "6a659882e8ec"
down_revision = "85138c4a60e0"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_tenant_invites_pending_tenant_email"


def upgrade() -> None:
    op.create_index(
        INDEX_NAME,
        "tenant_invitations",
        ["tenant_id", "email"],
        unique=True,
        postgresql_where=text("accepted_at IS NULL"),  # ✅ FIX
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="tenant_invitations")
