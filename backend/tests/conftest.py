from __future__ import annotations

import os
import uuid
import asyncio

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.db.session import get_db

# Ensure Base + models are registered before create_all
from app.db.base import Base  # noqa: F401
import app.models  # noqa: F401


# ---------------------------------------------------------
# Event loop (single loop for whole test session)
# ---------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
def event_loop():
    """
    Use ONE event loop for the whole test session.
    This MUST match asyncio_default_fixture_loop_scope=session in pytest.ini
    """
    loop = asyncio.new_event_loop()
    try:
        yield loop
    finally:
        loop.close()


# ---------------------------------------------------------
# Database config
# ---------------------------------------------------------
@pytest.fixture(scope="session")
def database_url_async() -> str:
    url = os.getenv("DATABASE_URL_ASYNC")
    if not url:
        raise RuntimeError(
            "DATABASE_URL_ASYNC is not set. Set it in your environment/.env."
        )
    return url


@pytest.fixture(scope="session")
def test_schema_name() -> str:
    return f"test_{uuid.uuid4().hex}"


# ---------------------------------------------------------
# Engine + schema lifecycle (CI-safe with retry)
# ---------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
async def engine(database_url_async: str, test_schema_name: str):
    engine = create_async_engine(
        database_url_async,
        future=True,
        echo=False,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": test_schema_name}},
    )

    # ------------------------------
    # Wait/retry for DB readiness
    # ------------------------------
    last_exc = None
    for _ in range(30):  # ~30 seconds max wait
        try:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            last_exc = None
            break
        except Exception as e:
            last_exc = e
            await asyncio.sleep(1)

    if last_exc is not None:
        raise RuntimeError(
            f"Database not reachable for tests: {last_exc}"
        ) from last_exc

    # ------------------------------
    # Create isolated test schema
    # ------------------------------
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{test_schema_name}"'))
        await conn.execute(text(f'SET search_path TO "{test_schema_name}"'))
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # ------------------------------
    # Teardown: drop schema
    # ------------------------------
    async with engine.begin() as conn:
        await conn.execute(text(f'DROP SCHEMA IF EXISTS "{test_schema_name}" CASCADE'))

    await engine.dispose()


@pytest.fixture(scope="session")
def sessionmaker(engine):
    return async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )


# ---------------------------------------------------------
# 🔑 AUTOUSE: clean DB before every test
# ---------------------------------------------------------
@pytest_asyncio.fixture(autouse=True)
async def _truncate_tables(engine, test_schema_name: str):
    """
    Ensure each test starts with a clean DB state.

    Truncates SQLAlchemy-mapped tables (Base.metadata),
    which is safer and deterministic.
    """
    async with engine.begin() as conn:
        await conn.execute(text(f'SET search_path TO "{test_schema_name}"'))

        table_names = [t.name for t in Base.metadata.sorted_tables]
        if table_names:
            qualified = ", ".join(
                f'"{test_schema_name}"."{name}"' for name in table_names
            )
            await conn.execute(
                text(f"TRUNCATE TABLE {qualified} RESTART IDENTITY CASCADE;")
            )

    yield


# ---------------------------------------------------------
# DB session for assertions / setup
# ---------------------------------------------------------
@pytest_asyncio.fixture()
async def db(sessionmaker):
    """
    Session for test setup & assertions ONLY.
    """
    async with sessionmaker() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------
# FastAPI app + dependency override
# ---------------------------------------------------------
@pytest.fixture()
def app(sessionmaker):
    from app.main import app as fastapi_app

    async def _override_get_db():
        async with sessionmaker() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------
# HTTP client
# ---------------------------------------------------------
@pytest_asyncio.fixture()
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as ac:
        yield ac
