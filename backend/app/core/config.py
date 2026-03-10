from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
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
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # -----------------------------
    # Media / Storage
    # -----------------------------
    STORAGE_PROVIDER: str = "local"
    MEDIA_ROOT: str = "media"
    MEDIA_URL: str = "/media"
    MEDIA_PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"

    # image optimization defaults
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

    # Optional frontend callback target for later UX handoff
    FRONTEND_SOCIAL_CALLBACK_URL: str | None = None

    # -----------------------------
    # AWS S3 / S3-compatible
    # -----------------------------
    AWS_S3_BUCKET: str | None = None
    AWS_S3_REGION: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_ENDPOINT_URL: str | None = None
    AWS_S3_PUBLIC_BASE_URL: str | None = None

    # -----------------------------
    # DigitalOcean Spaces
    # -----------------------------
    DO_SPACES_BUCKET: str | None = None
    DO_SPACES_REGION: str | None = None
    DO_SPACES_KEY: str | None = None
    DO_SPACES_SECRET: str | None = None
    DO_SPACES_ENDPOINT_URL: str | None = None
    DO_SPACES_PUBLIC_BASE_URL: str | None = None

    # -----------------------------
    # Google Cloud Storage
    # -----------------------------
    GCS_BUCKET: str | None = None
    GCS_PROJECT_ID: str | None = None
    GCS_CREDENTIALS_JSON: str | None = None
    GCS_PUBLIC_BASE_URL: str | None = None

    # -----------------------------
    # Safaricom Cloud
    # Treated as S3-compatible until a concrete storage API contract is chosen.
    # -----------------------------
    SAFARICOM_BUCKET: str | None = None
    SAFARICOM_REGION: str | None = None
    SAFARICOM_ACCESS_KEY_ID: str | None = None
    SAFARICOM_SECRET_ACCESS_KEY: str | None = None
    SAFARICOM_ENDPOINT_URL: str | None = None
    SAFARICOM_PUBLIC_BASE_URL: str | None = None

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

    def model_post_init(self, __context) -> None:
        env = (self.ENVIRONMENT or "").strip().lower()

        if env in {"staging", "production"}:
            if not self.JWT_SECRET or self.JWT_SECRET.strip() == "dev-secret-change-me":
                raise ValueError("JWT_SECRET must be set to a strong value in staging/production.")
            if len(self.JWT_SECRET.strip()) < 32:
                raise ValueError("JWT_SECRET is too short; use at least 32 characters in staging/production.")

        if self.JWT_ALGORITHM not in {"HS256"}:
            raise ValueError(f"Unsupported JWT_ALGORITHM={self.JWT_ALGORITHM!r}. Allowed: HS256")

        allowed_storage = {
            "local",
            "aws_s3",
            "digitalocean_spaces",
            "google_cloud_storage",
            "safaricom_cloud",
        }
        if self.STORAGE_PROVIDER_NORMALIZED not in allowed_storage:
            raise ValueError(
                f"Unsupported STORAGE_PROVIDER={self.STORAGE_PROVIDER!r}. "
                f"Allowed: {sorted(allowed_storage)}"
            )

        if self.IMAGE_MAX_WIDTH < 320:
            raise ValueError("IMAGE_MAX_WIDTH must be at least 320.")

        if not (40 <= self.IMAGE_JPEG_QUALITY <= 95):
            raise ValueError("IMAGE_JPEG_QUALITY must be between 40 and 95.")

        if not (40 <= self.IMAGE_WEBP_QUALITY <= 95):
            raise ValueError("IMAGE_WEBP_QUALITY must be between 40 and 95.")


settings = Settings()