"""add templates table

Revision ID: c0e0cbc82876
Revises: 4a7304ae9113
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0e0cbc82876'
down_revision = '4a7304ae9113'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create templates table
    op.create_table(
        'templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 🔧 CLEAN INVALID DATA BEFORE ENFORCING CONSTRAINTS
    op.execute("DELETE FROM campaigns WHERE product_id IS NULL")
    op.execute("DELETE FROM campaigns WHERE template_id IS NULL")

    # Enforce NOT NULL safely
    op.alter_column(
        'campaigns',
        'product_id',
        existing_type=sa.UUID(),
        nullable=False
    )

    op.alter_column(
        'campaigns',
        'template_id',
        existing_type=sa.VARCHAR(),
        nullable=False
    )


def downgrade() -> None:
    op.alter_column(
        'campaigns',
        'template_id',
        existing_type=sa.VARCHAR(),
        nullable=True
    )

    op.alter_column(
        'campaigns',
        'product_id',
        existing_type=sa.UUID(),
        nullable=True
    )

    op.drop_table('templates')