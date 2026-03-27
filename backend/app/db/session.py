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
DATABASE_URL_ASYNC = settings.DATABASE_URL_ASYNC_CLEAN

engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_recycle=300,
)

# ✅ Canonical session maker
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# ✅ Single source of truth
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session