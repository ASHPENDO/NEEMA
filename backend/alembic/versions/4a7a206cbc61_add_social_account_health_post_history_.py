from alembic import op
import sqlalchemy as sa


revision = '4a7a206cbc61'
down_revision = 'd0c26d3abe6a'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # =========================
    # ENUM (SAFE)
    # =========================
    status_enum = sa.Enum('active', 'disconnected', name='socialaccountstatus')
    status_enum.create(bind, checkfirst=True)

    # =========================
    # SOCIAL ACCOUNTS
    # =========================
    with op.batch_alter_table("social_accounts") as batch_op:
        batch_op.add_column(sa.Column("status", status_enum, nullable=False, server_default="active"))
        batch_op.add_column(sa.Column("requires_reauth", sa.Boolean(), nullable=False, server_default="false"))
        batch_op.add_column(sa.Column("last_error", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))

    # =========================
    # POST HISTORY
    # =========================
    with op.batch_alter_table("post_history") as batch_op:
        batch_op.add_column(sa.Column("failure_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    # 🔥 MAKE DOWNGRADE SAFE (NO HARD FAIL)
    with op.batch_alter_table("post_history") as batch_op:
        try:
            batch_op.drop_column("last_attempt_at")
        except Exception:
            pass
        try:
            batch_op.drop_column("retry_count")
        except Exception:
            pass
        try:
            batch_op.drop_column("failure_reason")
        except Exception:
            pass

    with op.batch_alter_table("social_accounts") as batch_op:
        try:
            batch_op.drop_column("last_checked_at")
        except Exception:
            pass
        try:
            batch_op.drop_column("last_error")
        except Exception:
            pass
        try:
            batch_op.drop_column("requires_reauth")
        except Exception:
            pass
        try:
            batch_op.drop_column("status")
        except Exception:
            pass

    try:
        sa.Enum(name='socialaccountstatus').drop(op.get_bind(), checkfirst=True)
    except Exception:
        pass