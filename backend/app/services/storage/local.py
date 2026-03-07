from __future__ import annotations

import os
from pathlib import Path

from app.core.config import settings
from app.services.storage.base import UploadResult


class LocalStorageAdapter:
    provider_name = "local"

    def __init__(self) -> None:
        self.root = Path(settings.MEDIA_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)

    def upload_bytes(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str,
        make_public: bool = True,
    ) -> UploadResult:
        normalized_key = key.lstrip("/").replace("\\", "/")
        abs_path = self.root / normalized_key
        abs_path.parent.mkdir(parents=True, exist_ok=True)

        with open(abs_path, "wb") as f:
            f.write(content)

        public_url = (
            f"{settings.MEDIA_PUBLIC_BASE_URL.rstrip('/')}"
            f"{settings.MEDIA_URL.rstrip('/')}/{normalized_key}"
        )

        return UploadResult(
            provider=self.provider_name,
            key=normalized_key,
            public_url=public_url,
            content_type=content_type,
            size_bytes=len(content),
        )

    def delete(self, *, key: str) -> None:
        normalized_key = key.lstrip("/").replace("\\", "/")
        abs_path = self.root / normalized_key
        if abs_path.exists():
            os.remove(abs_path)