from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps.permissions import require_permissions
from app.api.deps.tenant import get_current_membership
from app.models.catalog_item import CatalogItem
from app.schemas.catalog import CatalogItemCreate, CatalogItemUpdate, CatalogItemResponse

router = APIRouter(prefix="/catalog/items", tags=["catalog"])


@router.get("", response_model=List[CatalogItemResponse])
def list_catalog_items(
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.read")),
):
    items = (
        db.query(CatalogItem)
        .filter(CatalogItem.tenant_id == membership.tenant_id)
        .order_by(CatalogItem.created_at.desc())
        .all()
    )
    return items


@router.post("", response_model=CatalogItemResponse, status_code=status.HTTP_201_CREATED)
def create_catalog_item(
    payload: CatalogItemCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.write")),
):
    item = CatalogItem(
        id=uuid.uuid4(),
        tenant_id=membership.tenant_id,
        created_by_user_id=getattr(membership, "user_id", None),
        title=payload.title,
        sku=payload.sku,
        description=payload.description,
        price_amount=payload.price_amount,
        price_currency=payload.price_currency,
        status="active",
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=CatalogItemResponse)
def get_catalog_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.read")),
):
    item = (
        db.query(CatalogItem)
        .filter(CatalogItem.id == item_id, CatalogItem.tenant_id == membership.tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=CatalogItemResponse)
def update_catalog_item(
    item_id: uuid.UUID,
    payload: CatalogItemUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.write")),
):
    item = (
        db.query(CatalogItem)
        .filter(CatalogItem.id == item_id, CatalogItem.tenant_id == membership.tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.delete")),
):
    item = (
        db.query(CatalogItem)
        .filter(CatalogItem.id == item_id, CatalogItem.tenant_id == membership.tenant_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return None