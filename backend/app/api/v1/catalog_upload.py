# app/api/v1/catalog_upload.py
from __future__ import annotations

import json
import os
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
        # supports comma-separated tags
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
    title: str,
    sku: Optional[str],
    description: Optional[str],
    price_amount: Decimal,
    price_currency: str,
    status_value: str,
) -> CatalogItem:
    return CatalogItem(
        id=uuid.uuid4(),
        tenant_id=membership.tenant_id,
        created_by_user_id=getattr(membership, "user_id", None),
        title=title,
        sku=sku,
        description=description,
        price_amount=price_amount,
        price_currency=price_currency,
        status=status_value,
    )


def _safe_extract_zip(zip_path: str, extract_to: str) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_name = member.filename

            # skip macOS zip noise
            if member_name.startswith("__MACOSX/") or member_name.endswith(".DS_Store"):
                continue

            normalized_target = os.path.abspath(os.path.join(extract_to, member_name))
            if not normalized_target.startswith(os.path.abspath(extract_to)):
                raise HTTPException(status_code=400, detail="Invalid zip file structure")

        zf.extractall(extract_to)


def _find_product_dirs(root_dir: str) -> List[Tuple[str, str]]:
    """
    Returns list of:
      (folder_label, folder_path)
    where folder_path contains details.json.
    Supports:
      ZIP/
        PHONES/
          tecno1/details.json
          tecno2/details.json
    and also flatter variants.
    """
    found: List[Tuple[str, str]] = []

    for current_root, _, files in os.walk(root_dir):
        if "details.json" in files:
            folder_label = os.path.basename(current_root.rstrip(os.sep)) or current_root
            found.append((folder_label, current_root))

    # Avoid treating temp root itself as a product dir if someone places details.json there unexpectedly
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
    Accepts a ZIP file with this preferred structure:

    PHONES.zip
    └── PHONES/
        ├── tecno1/
        │   ├── details.json
        │   ├── image1.jpg
        │   └── video1.mp4
        ├── tecno2/
        │   ├── details.json
        │   └── image1.png
        └── tecno3/
            ├── details.json
            └── image1.webp

    Required details.json fields:
      - title (or name)
      - price_amount (or price)

    Optional:
      - sku
      - description
      - price_currency (or currency)
      - status
      - category
      - condition
      - brand
      - tags
      - social_hook
      - social_cta
      - social_caption
    """

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")

    created_items: List[CatalogItem] = []
    created_payloads: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    processed_count = 0

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

                item = _make_item(
                    membership=membership,
                    title=data["title"],
                    sku=data["sku"],
                    description=data["description"],
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
                        "db_item_ref": item,  # temp placeholder; replaced after refresh
                        "category": data["category"],
                        "condition": data["condition"],
                        "brand": data["brand"],
                        "tags": data["tags"],
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
        "processed_product_folders": processed_count,
        "created_count": len(final_created),
        "error_count": len(errors),
        "created": final_created,
        "errors": errors,
        "notes": [
            "Catalog items were created successfully.",
            "Media files were detected for future storage/publishing modules.",
            "Images/videos are not yet persisted to object storage in this endpoint.",
        ],
    }