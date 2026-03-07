from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class UploadResult:
    provider: str
    key: str
    public_url: str
    content_type: str
    size_bytes: int


class StorageAdapter(Protocol):
    provider_name: str

    def upload_bytes(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str,
        make_public: bool = True,
    ) -> UploadResult: ...

    def delete(self, *, key: str) -> None: ...