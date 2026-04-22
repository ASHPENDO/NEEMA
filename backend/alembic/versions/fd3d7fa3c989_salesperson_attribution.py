"""salesperson attribution

Revision ID: fd3d7fa3c989
Revises: 778b8a39d8fc
Create Date: 2026-04-22 07:40:13.813542
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd3d7fa3c989'
down_revision: Union[str, None] = '778b8a39d8fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ Add column
    op.add_column(
        "tenants",
        sa.Column(
            "salesperson_profile_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    # ✅ Add FK
    op.create_foreign_key(
        "fk_tenants_salesperson_profile",
        "tenants",
        "salesperson_profiles",
        ["salesperson_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ✅ Add index (important for lookup performance)
    op.create_index(
        "ix_tenants_salesperson_profile_id",
        "tenants",
        ["salesperson_profile_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tenants_salesperson_profile_id", table_name="tenants")

    op.drop_constraint(
        "fk_tenants_salesperson_profile",
        "tenants",
        type_="foreignkey",
    )

    op.drop_column("tenants", "salesperson_profile_id")