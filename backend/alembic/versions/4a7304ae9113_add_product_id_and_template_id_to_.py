"""add product_id and template_id to campaigns (safe migration)

Revision ID: 4a7304ae9113
Revises: f9555f481488
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = '4a7304ae9113'
down_revision: Union[str, None] = 'f9555f481488'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ 1. ADD COLUMNS AS NULLABLE FIRST (CRITICAL)
    op.add_column('campaigns', sa.Column('product_id', sa.UUID(), nullable=True))
    op.add_column('campaigns', sa.Column('template_id', sa.String(), nullable=True))
    op.add_column('campaigns', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    # ✅ 2. BACKFILL EXISTING ROWS (AVOID NULL CONSTRAINT ERROR)
    op.execute("""
        UPDATE campaigns
        SET 
            product_id = gen_random_uuid(),
            template_id = 'legacy',
            updated_at = now()
        WHERE product_id IS NULL
    """)

    # ✅ 3. ENFORCE NOT NULL AFTER DATA EXISTS
    op.alter_column('campaigns', 'product_id', nullable=False)
    op.alter_column('campaigns', 'template_id', nullable=False)

    # === EXISTING AUTO-GENERATED CHANGES (UNCHANGED) ===

    op.alter_column('campaigns', 'name',
               existing_type=sa.VARCHAR(),
               nullable=True)

    op.alter_column('campaigns', 'scheduled_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               nullable=True)

    op.alter_column('campaigns', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=True,
               existing_server_default=sa.text('now()'))

    op.create_index(op.f('ix_campaigns_tenant_id'), 'campaigns', ['tenant_id'], unique=False)

    op.alter_column('post_history', 'status',
               existing_type=sa.VARCHAR(),
               nullable=True,
               existing_server_default=sa.text("'pending'::character varying"))

    op.alter_column('post_history', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=True,
               existing_server_default=sa.text('now()'))

    op.create_index('ix_post_history_idem_lookup', 'post_history',
                    ['tenant_id', 'platform', 'page_id', 'idempotency_key'],
                    unique=False)

    op.create_index(op.f('ix_post_history_idempotency_key'),
                    'post_history', ['idempotency_key'], unique=False)

    op.alter_column('social_accounts', 'tenant_id',
               existing_type=sa.UUID(),
               nullable=False)

    op.alter_column('social_accounts', 'platform',
               existing_type=sa.VARCHAR(),
               nullable=False)

    op.alter_column('social_accounts', 'page_access_token',
               existing_type=sa.VARCHAR(),
               type_=sa.Text(),
               nullable=False)

    op.alter_column('social_accounts', 'page_id',
               existing_type=sa.VARCHAR(),
               nullable=False)

    op.alter_column('social_accounts', 'last_checked_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=sa.DateTime(),
               existing_nullable=True)

    op.drop_constraint('unique_social_account', 'social_accounts', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('unique_social_account', 'social_accounts', ['tenant_id', 'platform', 'page_id'])

    op.alter_column('social_accounts', 'last_checked_at',
               existing_type=sa.DateTime(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=True)

    op.alter_column('social_accounts', 'page_id',
               existing_type=sa.VARCHAR(),
               nullable=True)

    op.alter_column('social_accounts', 'page_access_token',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(),
               nullable=True)

    op.alter_column('social_accounts', 'platform',
               existing_type=sa.VARCHAR(),
               nullable=True)

    op.alter_column('social_accounts', 'tenant_id',
               existing_type=sa.UUID(),
               nullable=True)

    op.drop_index(op.f('ix_post_history_idempotency_key'), table_name='post_history')
    op.drop_index('ix_post_history_idem_lookup', table_name='post_history')

    op.alter_column('post_history', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               existing_server_default=sa.text('now()'))

    op.alter_column('post_history', 'status',
               existing_type=sa.VARCHAR(),
               nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))

    op.drop_index(op.f('ix_campaigns_tenant_id'), table_name='campaigns')

    op.alter_column('campaigns', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               existing_server_default=sa.text('now()'))

    op.alter_column('campaigns', 'scheduled_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               nullable=False)

    op.alter_column('campaigns', 'name',
               existing_type=sa.VARCHAR(),
               nullable=False)

    op.drop_column('campaigns', 'updated_at')
    op.drop_column('campaigns', 'template_id')
    op.drop_column('campaigns', 'product_id')