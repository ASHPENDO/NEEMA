from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps.permissions import require_permissions
from app.api.deps.tenant import get_current_membership
from app.models.catalog_item import CatalogItem
from app.schemas.catalog import CatalogItemCreate, CatalogItemUpdate, CatalogItemResponse

router = APIRouter(prefix="/catalog/items", tags=["catalog"])


@router.get("", response_model=List[CatalogItemResponse])
async def list_catalog_items(
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.read")),
):
    stmt = (
        select(CatalogItem)
        .where(CatalogItem.tenant_id == membership.tenant_id)
        .order_by(CatalogItem.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return items


@router.post("", response_model=CatalogItemResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog_item(
    payload: CatalogItemCreate,
    db: AsyncSession = Depends(get_db),
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
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=CatalogItemResponse)
async def get_catalog_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.read")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return item


@router.patch("/{item_id}", response_model=CatalogItemResponse)
async def update_catalog_item(
    item_id: uuid.UUID,
    payload: CatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.write")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog.delete")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()
    return None