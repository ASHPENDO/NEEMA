# app/api/v1/catalog_upload.py

from fastapi import APIRouter, UploadFile, File, HTTPException
import zipfile
import os
import json
import shutil
import uuid
from tempfile import TemporaryDirectory

router = APIRouter()


@router.post("/bulk-upload")
async def bulk_upload_catalog_zip(file: UploadFile = File(...)):
    """
    Accepts a ZIP file where each folder represents a product.
    Each folder must contain:
      - details.json
      - product images (jpg/png/webp/etc)
    """

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")

    created = []
    errors = []

    with TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "upload.zip")

        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            with zipfile.ZipFile(zip_path) as z:
                z.extractall(tmp)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file")

        for folder in os.listdir(tmp):
            folder_path = os.path.join(tmp, folder)

            if not os.path.isdir(folder_path):
                continue

            try:
                details_path = os.path.join(folder_path, "details.json")

                if not os.path.exists(details_path):
                    raise ValueError("details.json missing")

                with open(details_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                name = data.get("name")

                if not name:
                    raise ValueError("name missing in details.json")

                images = [
                    f for f in os.listdir(folder_path)
                    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))
                ]

                created.append({
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "sku": data.get("sku"),
                    "price": data.get("price"),
                    "currency": data.get("currency"),
                    "description": data.get("description"),
                    "is_active": data.get("is_active", True),
                    "image_count": len(images),
                })

            except Exception as e:
                errors.append({
                    "folder": folder,
                    "reason": str(e),
                })

    return {
        "created": created,
        "errors": errors,
    }