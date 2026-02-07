# backend/app/core/config.py

from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from pydantic_settings import BaseSettings, SettingsConfigDict


def _strip_asyncpg_unsupported_params(url: str) -> str:
    """
    asyncpg does NOT accept sslmode or channel_binding as connect kwargs.
    If these appear in the URL query, SQLAlchemy can end up passing them to
    asyncpg.connect(), causing:
      TypeError: connect() got an unexpected keyword argument 'sslmode'
    """
    parts = urlsplit(url)
    if not parts.query:
        return url

    params = parse_qsl(parts.query, keep_blank_values=True)
    filtered = [(k, v) for (k, v) in params if k not in {"sslmode", "channel_binding"}]
    new_query = urlencode(filtered, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # DB
    DATABASE_URL_ASYNC: str
    DATABASE_URL_SYNC: str

    # JWT (dev)
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def DATABASE_URL_ASYNC_CLEAN(self) -> str:
        return _strip_asyncpg_unsupported_params(self.DATABASE_URL_ASYNC)


# ✅ this must exist for: `from app.core.config import settings`
settings = Settings()
