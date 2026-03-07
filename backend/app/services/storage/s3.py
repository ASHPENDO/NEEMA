from __future__ import annotations

import boto3

from app.services.storage.base import UploadResult


class S3CompatibleStorageAdapter:
    def __init__(
        self,
        *,
        provider_name: str,
        bucket: str,
        region: str | None,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str | None = None,
        public_base_url: str | None = None,
    ) -> None:
        self.provider_name = provider_name
        self.bucket = bucket
        self.region = region
        self.endpoint_url = endpoint_url
        self.public_base_url = public_base_url.rstrip("/") if public_base_url else None

        self.client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    def upload_bytes(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str,
        make_public: bool = True,
    ) -> UploadResult:
        extra_args = {"ContentType": content_type}
        if make_public:
            extra_args["ACL"] = "public-read"

        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            **extra_args,
        )

        if self.public_base_url:
            public_url = f"{self.public_base_url}/{key}"
        elif self.endpoint_url:
            public_url = f"{self.endpoint_url.rstrip('/')}/{self.bucket}/{key}"
        else:
            region_part = f".{self.region}" if self.region else ""
            public_url = f"https://{self.bucket}.s3{region_part}.amazonaws.com/{key}"

        return UploadResult(
            provider=self.provider_name,
            key=key,
            public_url=public_url,
            content_type=content_type,
            size_bytes=len(content),
        )

    def delete(self, *, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)