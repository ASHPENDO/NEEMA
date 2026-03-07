from __future__ import annotations

import json

from google.cloud import storage
from google.oauth2 import service_account

from app.services.storage.base import UploadResult


class GoogleCloudStorageAdapter:
    provider_name = "google_cloud_storage"

    def __init__(
        self,
        *,
        bucket: str,
        project_id: str | None = None,
        credentials_json: str | None = None,
        public_base_url: str | None = None,
    ) -> None:
        self.bucket_name = bucket
        self.public_base_url = public_base_url.rstrip("/") if public_base_url else None

        if credentials_json:
            info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(info)
            self.client = storage.Client(project=project_id, credentials=credentials)
        else:
            self.client = storage.Client(project=project_id)

        self.bucket = self.client.bucket(bucket)

    def upload_bytes(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str,
        make_public: bool = True,
    ) -> UploadResult:
        blob = self.bucket.blob(key)
        blob.upload_from_string(content, content_type=content_type)

        if make_public:
            blob.make_public()

        if self.public_base_url:
            public_url = f"{self.public_base_url}/{key}"
        else:
            public_url = blob.public_url

        return UploadResult(
            provider=self.provider_name,
            key=key,
            public_url=public_url,
            content_type=content_type,
            size_bytes=len(content),
        )

    def delete(self, *, key: str) -> None:
        blob = self.bucket.blob(key)
        blob.delete()