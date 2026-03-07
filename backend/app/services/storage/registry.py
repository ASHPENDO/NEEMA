from __future__ import annotations

from app.core.config import settings
from app.services.storage.gcs import GoogleCloudStorageAdapter
from app.services.storage.local import LocalStorageAdapter
from app.services.storage.s3 import S3CompatibleStorageAdapter


def get_storage_adapter():
    provider = settings.STORAGE_PROVIDER_NORMALIZED

    if provider == "local":
        return LocalStorageAdapter()

    if provider == "aws_s3":
        return S3CompatibleStorageAdapter(
            provider_name="aws_s3",
            bucket=_required(settings.AWS_S3_BUCKET, "AWS_S3_BUCKET"),
            region=settings.AWS_S3_REGION,
            access_key_id=_required(settings.AWS_ACCESS_KEY_ID, "AWS_ACCESS_KEY_ID"),
            secret_access_key=_required(settings.AWS_SECRET_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY"),
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            public_base_url=settings.AWS_S3_PUBLIC_BASE_URL,
        )

    if provider == "digitalocean_spaces":
        return S3CompatibleStorageAdapter(
            provider_name="digitalocean_spaces",
            bucket=_required(settings.DO_SPACES_BUCKET, "DO_SPACES_BUCKET"),
            region=settings.DO_SPACES_REGION,
            access_key_id=_required(settings.DO_SPACES_KEY, "DO_SPACES_KEY"),
            secret_access_key=_required(settings.DO_SPACES_SECRET, "DO_SPACES_SECRET"),
            endpoint_url=_required(settings.DO_SPACES_ENDPOINT_URL, "DO_SPACES_ENDPOINT_URL"),
            public_base_url=settings.DO_SPACES_PUBLIC_BASE_URL,
        )

    if provider == "google_cloud_storage":
        return GoogleCloudStorageAdapter(
            bucket=_required(settings.GCS_BUCKET, "GCS_BUCKET"),
            project_id=settings.GCS_PROJECT_ID,
            credentials_json=settings.GCS_CREDENTIALS_JSON,
            public_base_url=settings.GCS_PUBLIC_BASE_URL,
        )

    if provider == "safaricom_cloud":
        return S3CompatibleStorageAdapter(
            provider_name="safaricom_cloud",
            bucket=_required(settings.SAFARICOM_BUCKET, "SAFARICOM_BUCKET"),
            region=settings.SAFARICOM_REGION,
            access_key_id=_required(settings.SAFARICOM_ACCESS_KEY_ID, "SAFARICOM_ACCESS_KEY_ID"),
            secret_access_key=_required(settings.SAFARICOM_SECRET_ACCESS_KEY, "SAFARICOM_SECRET_ACCESS_KEY"),
            endpoint_url=_required(settings.SAFARICOM_ENDPOINT_URL, "SAFARICOM_ENDPOINT_URL"),
            public_base_url=settings.SAFARICOM_PUBLIC_BASE_URL,
        )

    raise ValueError(f"Unsupported storage provider: {provider!r}")


def _required(value: str | None, name: str) -> str:
    if not value or not value.strip():
        raise ValueError(f"{name} is required for the selected storage provider.")
    return value.strip()