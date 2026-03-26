from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5513b190f022'
down_revision: Union[str, None] = '7ce9a53c6c77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'facebook_catalogs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('meta_catalog_id', sa.String(), nullable=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'social_accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('platform', sa.String(), nullable=True),
        sa.Column('meta_user_id', sa.String(), nullable=True),
        sa.Column('access_token', sa.String(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('page_id', sa.String(), nullable=True),
        sa.Column('page_name', sa.String(), nullable=True),
        sa.Column('page_access_token', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Optional index for performance
    op.create_index(
        'ix_social_accounts_tenant_id',
        'social_accounts',
        ['tenant_id']
    )


def downgrade() -> None:
    op.drop_index('ix_social_accounts_tenant_id', table_name='social_accounts')
    op.drop_table('social_accounts')
    op.drop_table('facebook_catalogs')