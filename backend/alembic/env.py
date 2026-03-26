# alembic/env.py
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ✅ Import app config (single source of truth)
from app.core.config import settings  # noqa: E402

# Models
from app.db.base import Base  # noqa: E402
import app.models  # noqa: F401, E402

target_metadata = Base.metadata


def include_object(object_, name, type_, reflected, compare_to):
    # Prevent autogenerate from trying to drop these partial unique indexes
    if type_ == "index" and name in {
        "uq_platform_invitations_pending_email",
        "uq_tenant_invites_pending_tenant_email",
    }:
        return False
    return True


def _get_db_url() -> str:
    """
    Always use application database config.
    This eliminates env/alembic.ini mismatch completely.
    """
    return settings.DATABASE_URL_SYNC


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = _get_db_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    # ✅ Force Alembic to use same DB as app
    config.set_main_option(
        "sqlalchemy.url",
        settings.DATABASE_URL_SYNC
    )

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()