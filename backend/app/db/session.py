from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# -----------------------------
# Async engine (FastAPI)
# -----------------------------
# Use CLEAN URL to avoid asyncpg errors with sslmode/channel_binding query params.
DATABASE_URL_ASYNC = settings.DATABASE_URL_ASYNC_CLEAN

engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=False,
    future=True,
    pool_pre_ping=True,  # detects dead connections before using them
    pool_recycle=300,    # recycle connections periodically (seconds)
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides one AsyncSession per request.
    Always closes the session after the request completes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()