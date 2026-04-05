from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


def _strip_asyncpg_unsupported_params(url: str) -> str:
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
    ENVIRONMENT: str = "development"

    # -----------------------------
    # DB
    # -----------------------------
    DATABASE_URL_ASYNC: str
    DATABASE_URL_SYNC: str

    # -----------------------------
    # JWT
    # -----------------------------
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # -----------------------------
    # REDIS
    # -----------------------------
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # -----------------------------
    # Media / Storage
    # -----------------------------
    STORAGE_PROVIDER: str = "local"
    MEDIA_ROOT: str = "media"
    MEDIA_URL: str = "/media"
    MEDIA_PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"

    IMAGE_MAX_WIDTH: int = 1080
    IMAGE_JPEG_QUALITY: int = 85
    IMAGE_CREATE_WEBP: bool = True
    IMAGE_WEBP_QUALITY: int = 82

    # -----------------------------
    # Meta OAuth / Graph API
    # -----------------------------
    META_APP_ID: str | None = None
    META_APP_SECRET: str | None = None
    META_REDIRECT_URI: str = "http://127.0.0.1:8000/api/v1/social/facebook/callback"
    META_GRAPH_API_VERSION: str = "v23.0"

    META_SCOPES: str = (
        "pages_show_list,"
        "pages_read_engagement,"
        "pages_manage_posts,"
        "business_management,"
        "instagram_basic,"
        "instagram_content_publish,"
        "whatsapp_business_management,"
        "whatsapp_business_messaging"
    )

    FRONTEND_SOCIAL_CALLBACK_URL: str | None = None

    # ==================================================
    # 🔐 SAFE MODE (NEW — DOES NOT BREAK EXISTING LOGIC)
    # ==================================================
    SAFE_MODE: bool = True
    SAFE_PAGE_IDS: list[str] = ["YOUR_TEST_PAGE_ID"]
    SAFE_POST_INTERVAL: int = 120
    SAFE_ENABLE_SCHEDULER_POSTING: bool = False
    POSTING_MODE: str = "safe"
    # ==================================================

    # -----------------------------
    # Derived Properties
    # -----------------------------
    @property
    def DATABASE_URL_ASYNC_CLEAN(self) -> str:
        return _strip_asyncpg_unsupported_params(self.DATABASE_URL_ASYNC)

    @property
    def MEDIA_ROOT_ABS(self) -> str:
        return self.MEDIA_ROOT

    @property
    def STORAGE_PROVIDER_NORMALIZED(self) -> str:
        return (self.STORAGE_PROVIDER or "local").strip().lower()

    @property
    def META_GRAPH_BASE_URL(self) -> str:
        return f"https://graph.facebook.com/{self.META_GRAPH_API_VERSION}"

    @property
    def META_OAUTH_DIALOG_URL(self) -> str:
        return f"https://www.facebook.com/{self.META_GRAPH_API_VERSION}/dialog/oauth"

    @property
    def META_SCOPE_LIST(self) -> list[str]:
        return [s.strip() for s in (self.META_SCOPES or "").split(",") if s.strip()]

    # -----------------------------
    # Validation (IMPORTANT — PRESERVED)
    # -----------------------------
    def model_post_init(self, __context) -> None:
        env = (self.ENVIRONMENT or "").strip().lower()

        if env in {"staging", "production"}:
            if not self.JWT_SECRET or self.JWT_SECRET.strip() == "dev-secret-change-me":
                raise ValueError("JWT_SECRET must be set in production.")
            if len(self.JWT_SECRET.strip()) < 32:
                raise ValueError("JWT_SECRET too short.")

        if self.JWT_ALGORITHM not in {"HS256"}:
            raise ValueError(f"Unsupported JWT_ALGORITHM={self.JWT_ALGORITHM}")

        allowed_storage = {
            "local",
            "aws_s3",
            "digitalocean_spaces",
            "google_cloud_storage",
            "safaricom_cloud",
        }

        if self.STORAGE_PROVIDER_NORMALIZED not in allowed_storage:
            raise ValueError(f"Unsupported STORAGE_PROVIDER={self.STORAGE_PROVIDER}")

        if self.IMAGE_MAX_WIDTH < 320:
            raise ValueError("IMAGE_MAX_WIDTH must be >= 320")

        if not (40 <= self.IMAGE_JPEG_QUALITY <= 95):
            raise ValueError("Invalid JPEG quality")

        if not (40 <= self.IMAGE_WEBP_QUALITY <= 95):
            raise ValueError("Invalid WEBP quality")


settings = Settings()