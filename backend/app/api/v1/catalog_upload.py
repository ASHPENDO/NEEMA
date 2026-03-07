# app/api/v1/catalog_upload.py
from __future__ import annotations

import json
import os
import re
import shutil
import uuid
import zipfile
from decimal import Decimal, InvalidOperation
from tempfile import TemporaryDirectory
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.permissions import require_permissions
from app.api.deps.tenant import get_current_membership
from app.db.session import get_db
from app.models.catalog_item import CatalogItem
from app.schemas.catalog import CatalogItemResponse
from app.services.media.image_optimizer import optimize_image
from app.services.storage.registry import get_storage_adapter

router = APIRouter()


# ------------------------------------------------------------------
# Allowed media
# ------------------------------------------------------------------

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _coerce_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        cleaned = "".join(ch for ch in raw if ch.isdigit() or ch == ".")
        if not cleaned:
            return None
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None
    return None


def _normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value or None


def _normalize_tags(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: List[str] = []
        for item in value:
            s = _normalize_str(item)
            if s:
                out.append(s)
        return out
    if isinstance(value, str):
        parts = [x.strip() for x in value.split(",")]
        return [x for x in parts if x]
    return []


def _infer_media_kind(filename: str) -> Optional[str]:
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return None


def _list_media_files(folder_path: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for name in sorted(os.listdir(folder_path)):
        abs_path = os.path.join(folder_path, name)
        if not os.path.isfile(abs_path):
            continue

        kind = _infer_media_kind(name)
        if not kind:
            continue

        items.append(
            {
                "filename": name,
                "kind": kind,
                "sort_order": len(items) + 1,
                "is_primary": len(items) == 0,
            }
        )

    return items


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "item"


def _pick_primary_local_image_filename(media_files: List[Dict[str, Any]]) -> Optional[str]:
    for media in media_files:
        if media.get("kind") == "image" and media.get("filename"):
            return str(media["filename"]).strip() or None
    return None


def _build_storage_key(
    *,
    tenant_id: Any,
    folder_label: str,
    title: str,
    item_id: uuid.UUID,
    ext: str,
) -> str:
    tenant_part = str(tenant_id)
    folder_part = _slugify(folder_label)
    title_part = _slugify(title)
    return f"catalog/{tenant_part}/{folder_part}/{title_part}-{item_id}.{ext}"


def _process_and_upload_primary_image(
    *,
    storage: Any,
    tenant_id: Any,
    folder_label: str,
    title: str,
    item_id: uuid.UUID,
    folder_path: str,
    details_image_url: Optional[str],
    media_files: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Priority:
    1. If details.json provides image_url, keep it as-is.
    2. Otherwise, take the first local image, optimize it, upload JPEG (+ optional WebP),
       and return the public URL.
    """
    if details_image_url:
        return {
            "image_url": details_image_url,
            "primary_image": details_image_url,
            "image_source": "details_image_url",
            "image_uploaded": False,
            "image_skipped": False,
            "uploaded_assets": [],
            "skipped_reason": None,
        }

    primary_filename = _pick_primary_local_image_filename(media_files)
    if not primary_filename:
        return {
            "image_url": None,
            "primary_image": None,
            "image_source": None,
            "image_uploaded": False,
            "image_skipped": True,
            "uploaded_assets": [],
            "skipped_reason": "No local image file found in product folder.",
        }

    image_path = os.path.join(folder_path, primary_filename)
    if not os.path.isfile(image_path):
        return {
            "image_url": None,
            "primary_image": primary_filename,
            "image_source": "zip_file",
            "image_uploaded": False,
            "image_skipped": True,
            "uploaded_assets": [],
            "skipped_reason": f"Primary image file not found: {primary_filename}",
        }

    with open(image_path, "rb") as f:
        original_bytes = f.read()

    optimized = optimize_image(original_bytes)

    jpeg_key = _build_storage_key(
        tenant_id=tenant_id,
        folder_label=folder_label,
        title=title,
        item_id=item_id,
        ext="jpg",
    )
    jpeg_upload = storage.upload_bytes(
        key=jpeg_key,
        content=optimized.jpeg_bytes,
        content_type=optimized.jpeg_content_type,
        make_public=True,
    )

    uploaded_assets = [
        {
            "variant": "jpeg",
            "key": jpeg_upload.key,
            "url": jpeg_upload.public_url,
            "content_type": jpeg_upload.content_type,
            "size_bytes": jpeg_upload.size_bytes,
            "width": optimized.width,
            "height": optimized.height,
        }
    ]

    if optimized.webp_bytes and optimized.webp_content_type:
        webp_key = _build_storage_key(
            tenant_id=tenant_id,
            folder_label=folder_label,
            title=title,
            item_id=item_id,
            ext="webp",
        )
        webp_upload = storage.upload_bytes(
            key=webp_key,
            content=optimized.webp_bytes,
            content_type=optimized.webp_content_type,
            make_public=True,
        )
        uploaded_assets.append(
            {
                "variant": "webp",
                "key": webp_upload.key,
                "url": webp_upload.public_url,
                "content_type": webp_upload.content_type,
                "size_bytes": webp_upload.size_bytes,
                "width": optimized.width,
                "height": optimized.height,
            }
        )

    return {
        "image_url": jpeg_upload.public_url,
        "primary_image": primary_filename,
        "image_source": "optimized_upload",
        "image_uploaded": True,
        "image_skipped": False,
        "uploaded_assets": uploaded_assets,
        "skipped_reason": None,
    }


def _build_social_caption_seed(
    *,
    title: str,
    price_amount: Decimal,
    price_currency: str,
    description: Optional[str],
    category: Optional[str],
    condition: Optional[str],
    tags: List[str],
    social_hook: Optional[str],
    social_cta: Optional[str],
) -> str:
    parts: List[str] = []

    if social_hook:
        parts.append(social_hook)

    parts.append(f"{title} — {price_currency} {price_amount}")

    meta_bits: List[str] = []
    if category:
        meta_bits.append(category)
    if condition:
        meta_bits.append(condition)
    if meta_bits:
        parts.append(" | ".join(meta_bits))

    if description:
        trimmed = description.strip()
        if len(trimmed) > 220:
            trimmed = trimmed[:217].rstrip() + "..."
        parts.append(trimmed)

    if tags:
        hashtag_line = " ".join(
            f"#{tag.replace(' ', '').replace('-', '').replace('.', '')}"
            for tag in tags[:8]
            if tag.strip()
        )
        if hashtag_line.strip():
            parts.append(hashtag_line)

    if social_cta:
        parts.append(social_cta)

    return "\n".join(parts)


def _make_item(
    *,
    membership: Any,
    item_id: uuid.UUID,
    title: str,
    sku: Optional[str],
    description: Optional[str],
    image_url: Optional[str],
    price_amount: Decimal,
    price_currency: str,
    status_value: str,
) -> CatalogItem:
    return CatalogItem(
        id=item_id,
        tenant_id=membership.tenant_id,
        created_by_user_id=getattr(membership, "user_id", None),
        title=title,
        sku=sku,
        description=description,
        image_url=image_url,
        price_amount=price_amount,
        price_currency=price_currency,
        status=status_value,
    )


def _safe_extract_zip(zip_path: str, extract_to: str) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_name = member.filename

            if member_name.startswith("__MACOSX/") or member_name.endswith(".DS_Store"):
                continue

            normalized_target = os.path.abspath(os.path.join(extract_to, member_name))
            if not normalized_target.startswith(os.path.abspath(extract_to)):
                raise HTTPException(status_code=400, detail="Invalid zip file structure")

        zf.extractall(extract_to)


def _find_product_dirs(root_dir: str) -> List[Tuple[str, str]]:
    found: List[Tuple[str, str]] = []

    for current_root, _, files in os.walk(root_dir):
        if "details.json" in files:
            folder_label = os.path.basename(current_root.rstrip(os.sep)) or current_root
            found.append((folder_label, current_root))

    found = [(label, path) for (label, path) in found if os.path.abspath(path) != os.path.abspath(root_dir)]
    found.sort(key=lambda x: x[0].lower())
    return found


def _validate_details_json(data: Dict[str, Any]) -> Dict[str, Any]:
    title = _normalize_str(data.get("title") or data.get("name"))
    if not title:
        raise ValueError("title missing in details.json")

    if len(title) > 255:
        raise ValueError("title exceeds 255 characters")

    sku = _normalize_str(data.get("sku"))
    if sku and len(sku) > 128:
        raise ValueError("sku exceeds 128 characters")

    description = _normalize_str(data.get("description"))
    image_url = _normalize_str(data.get("image_url"))
    if image_url and len(image_url) > 2048:
        raise ValueError("image_url exceeds 2048 characters")

    price_amount = _coerce_decimal(data.get("price_amount", data.get("price")))
    if price_amount is None or price_amount <= 0:
        raise ValueError("price_amount must be a positive number")

    price_currency = _normalize_str(data.get("price_currency") or data.get("currency") or "KES")
    if not price_currency:
        price_currency = "KES"
    if len(price_currency) > 8:
        raise ValueError("price_currency exceeds 8 characters")

    status_value = _normalize_str(data.get("status")) or "active"
    if len(status_value) > 32:
        raise ValueError("status exceeds 32 characters")

    category = _normalize_str(data.get("category"))
    condition = _normalize_str(data.get("condition"))
    brand = _normalize_str(data.get("brand"))
    tags = _normalize_tags(data.get("tags"))

    social_hook = _normalize_str(data.get("social_hook"))
    social_cta = _normalize_str(data.get("social_cta"))
    social_caption = _normalize_str(data.get("social_caption"))

    return {
        "title": title,
        "sku": sku,
        "description": description,
        "image_url": image_url,
        "price_amount": price_amount,
        "price_currency": price_currency,
        "status": status_value,
        "category": category,
        "condition": condition,
        "brand": brand,
        "tags": tags,
        "social_hook": social_hook,
        "social_cta": social_cta,
        "social_caption": social_caption,
    }


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------

@router.post("/bulk-upload", status_code=status.HTTP_201_CREATED)
async def bulk_upload_catalog_zip(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:create")),
):
    """
    Accepts a ZIP file with product folders containing:
      - details.json
      - optional image/video files

    Image behavior:
      - If details.json.image_url is provided, it is used as-is.
      - Otherwise the first local image is optimized and uploaded via the
        configured storage adapter, and the public URL is saved to image_url.
    """

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")

    storage = get_storage_adapter()

    created_items: List[CatalogItem] = []
    created_payloads: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    notifications: List[Dict[str, Any]] = []
    processed_count = 0
    uploaded_images_count = 0
    skipped_images_count = 0

    with TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "upload.zip")
        extract_dir = os.path.join(tmp, "extracted")
        os.makedirs(extract_dir, exist_ok=True)

        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            _safe_extract_zip(zip_path, extract_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to extract zip file")

        product_dirs = _find_product_dirs(extract_dir)
        if not product_dirs:
            raise HTTPException(
                status_code=400,
                detail="No product folders found. Each product folder must contain details.json.",
            )

        for folder_label, folder_path in product_dirs:
            processed_count += 1

            try:
                details_path = os.path.join(folder_path, "details.json")
                with open(details_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)

                if not isinstance(raw_data, dict):
                    raise ValueError("details.json must contain a JSON object")

                data = _validate_details_json(raw_data)
                media_files = _list_media_files(folder_path)

                item_id = uuid.uuid4()

                image_result = _process_and_upload_primary_image(
                    storage=storage,
                    tenant_id=membership.tenant_id,
                    folder_label=folder_label,
                    title=data["title"],
                    item_id=item_id,
                    folder_path=folder_path,
                    details_image_url=data["image_url"],
                    media_files=media_files,
                )

                if image_result["image_uploaded"]:
                    uploaded_images_count += 1
                    notifications.append(
                        {
                            "folder": folder_label,
                            "type": "image_uploaded",
                            "message": f"Primary image uploaded successfully for {data['title']}.",
                            "image_source": image_result["image_source"],
                            "image_url": image_result["image_url"],
                        }
                    )
                elif image_result["image_skipped"]:
                    skipped_images_count += 1
                    notifications.append(
                        {
                            "folder": folder_label,
                            "type": "image_skipped",
                            "message": image_result["skipped_reason"] or f"Primary image skipped for {data['title']}.",
                            "image_source": image_result["image_source"],
                            "image_url": image_result["image_url"],
                        }
                    )

                item = _make_item(
                    membership=membership,
                    item_id=item_id,
                    title=data["title"],
                    sku=data["sku"],
                    description=data["description"],
                    image_url=image_result["image_url"],
                    price_amount=data["price_amount"],
                    price_currency=data["price_currency"],
                    status_value=data["status"],
                )
                db.add(item)
                created_items.append(item)

                caption_seed = data["social_caption"] or _build_social_caption_seed(
                    title=data["title"],
                    price_amount=data["price_amount"],
                    price_currency=data["price_currency"],
                    description=data["description"],
                    category=data["category"],
                    condition=data["condition"],
                    tags=data["tags"],
                    social_hook=data["social_hook"],
                    social_cta=data["social_cta"],
                )

                created_payloads.append(
                    {
                        "folder": folder_label,
                        "db_item_ref": item,
                        "category": data["category"],
                        "condition": data["condition"],
                        "brand": data["brand"],
                        "tags": data["tags"],
                        "primary_image": image_result["primary_image"],
                        "image_source": image_result["image_source"],
                        "uploaded_assets": image_result["uploaded_assets"],
                        "media_files": media_files,
                        "image_count": sum(1 for m in media_files if m["kind"] == "image"),
                        "video_count": sum(1 for m in media_files if m["kind"] == "video"),
                        "social_posting": {
                            "caption_seed": caption_seed,
                            "social_hook": data["social_hook"],
                            "social_cta": data["social_cta"],
                        },
                    }
                )

            except Exception as e:
                errors.append(
                    {
                        "folder": folder_label,
                        "reason": str(e),
                    }
                )
                notifications.append(
                    {
                        "folder": folder_label,
                        "type": "product_skipped",
                        "message": str(e),
                    }
                )

        if not created_items and errors:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "No valid products were found in the zip file.",
                    "errors": errors,
                },
            )

        await db.commit()

        for item in created_items:
            await db.refresh(item)

        final_created: List[Dict[str, Any]] = []
        for payload in created_payloads:
            item = payload.pop("db_item_ref")
            final_created.append(
                {
                    "item": CatalogItemResponse.model_validate(item, from_attributes=True),
                    **payload,
                }
            )

    return {
        "filename": file.filename,
        "storage_provider": getattr(storage, "provider_name", "unknown"),
        "processed_product_folders": processed_count,
        "created_count": len(final_created),
        "error_count": len(errors),
        "uploaded_images_count": uploaded_images_count,
        "skipped_images_count": skipped_images_count,
        "created": final_created,
        "errors": errors,
        "notifications": notifications,
        "notes": [
            "Catalog items were created successfully.",
            "Primary local images are now optimized before upload when present.",
            "Public image URLs are saved to image_url through the configured storage adapter.",
            "If details.json.image_url is provided, it is preserved as-is.",
        ],
    }