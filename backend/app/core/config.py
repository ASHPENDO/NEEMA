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

    # -----------------------------
    # Environment
    # -----------------------------
    # Use: development | staging | production
    ENVIRONMENT: str = "development"

    # -----------------------------
    # DB
    # -----------------------------
    DATABASE_URL_ASYNC: str
    DATABASE_URL_SYNC: str

    # -----------------------------
    # JWT
    # -----------------------------
    # Keep a dev default, but enforce stronger requirements outside dev.
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def DATABASE_URL_ASYNC_CLEAN(self) -> str:
        return _strip_asyncpg_unsupported_params(self.DATABASE_URL_ASYNC)

    def model_post_init(self, __context) -> None:  # pydantic v2 hook
        env = (self.ENVIRONMENT or "").strip().lower()

        # Enforce that we never run staging/production with a placeholder secret.
        if env in {"staging", "production"}:
            if not self.JWT_SECRET or self.JWT_SECRET.strip() == "dev-secret-change-me":
                raise ValueError("JWT_SECRET must be set to a strong value in staging/production.")
            if len(self.JWT_SECRET.strip()) < 32:
                raise ValueError("JWT_SECRET is too short; use at least 32 characters in staging/production.")

        # Light sanity checks (all envs)
        if self.JWT_ALGORITHM not in {"HS256"}:
            raise ValueError(f"Unsupported JWT_ALGORITHM={self.JWT_ALGORITHM!r}. Allowed: HS256")


# ✅ this must exist for: `from app.core.config import settings`
settings = Settings()
