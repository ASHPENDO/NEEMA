"""unique pending platform invitation per email

Revision ID: 85138c4a60e0
Revises: f30888e5800a
Create Date: <AUTO>

"""
from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "85138c4a60e0"
down_revision = "f30888e5800a"
branch_labels = None
depends_on = None


INDEX_NAME = "uq_platform_invitations_pending_email"


def upgrade() -> None:
    # Enforce: only one pending invitation per email (case-insensitive)
    # Pending = accepted_at IS NULL
    op.execute(
        f"""
        CREATE UNIQUE INDEX {INDEX_NAME}
        ON platform_invitations (lower(email))
        WHERE accepted_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME};")
