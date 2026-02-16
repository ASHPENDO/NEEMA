# app/api/v1/platform_sales.py
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.models.platform_membership import PlatformMembership
from app.models.salesperson_profile import SalespersonProfile
from app.models.user import User
from app.schemas.platform_sales import (
    SalespersonCreate,
    SalespersonListOut,
    SalespersonOut,
    SalespersonUpdate,
)

router = APIRouter(prefix="/platform-sales", tags=["platform-sales"])

# Platform-admin roles (matches platform_invitations.py _require_any_platform_admin)
PLATFORM_ADMIN_ROLES = {"SUPER_ADMIN", "STAFF"}

MAX_CODE_RETRIES = 30
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_platform_membership(db: AsyncSession, user_id: UUID) -> PlatformMembership | None:
    stmt = select(PlatformMembership).where(PlatformMembership.user_id == user_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def _require_any_platform_admin(m: PlatformMembership | None) -> None:
    if not m or not m.is_active or (m.role or "").upper() not in PLATFORM_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role: SUPER_ADMIN or STAFF required",
        )


def _gen_referral_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(6))


async def _allocate_unique_referral_code(db: AsyncSession) -> str:
    """
    Collision-safe allocator.
    We pre-check to reduce collisions, and still rely on unique constraint at commit time.
    """
    for _ in range(MAX_CODE_RETRIES):
        code = _gen_referral_code()
        exists = (
            await db.execute(
                select(SalespersonProfile.id).where(SalespersonProfile.referral_code == code)
            )
        ).first()
        if exists:
            continue
        return code
    raise HTTPException(status_code=500, detail="Could not allocate unique referral code")


@router.post("/salespeople", response_model=SalespersonOut, status_code=status.HTTP_201_CREATED)
async def create_salesperson(
    payload: SalespersonCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)

    try:
        payload.validate_choice()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Resolve or create user
    target_user: User | None = None
    if payload.user_id is not None:
        target_user = await db.get(User, payload.user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        email = str(payload.email).strip().lower()
        target_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if target_user is None:
            # Match platform_invitations behavior (email-only user creation)
            target_user = User(email=email)
            db.add(target_user)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                # race: created concurrently
                target_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
                if target_user is None:
                    raise HTTPException(status_code=500, detail="Failed to create user")

    # Ensure profile doesn't already exist
    existing = (
        await db.execute(
            select(SalespersonProfile).where(SalespersonProfile.user_id == target_user.id)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Salesperson profile already exists for this user")

    code = await _allocate_unique_referral_code(db)
    sp = SalespersonProfile(
        user_id=target_user.id,
        referral_code=code,
        is_active=True,
        last_payment_phone=payload.last_payment_phone,
        # created_at handled by model default
    )
    db.add(sp)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflict creating salesperson profile")

    await db.refresh(sp)
    return sp


@router.get("/salespeople", response_model=SalespersonListOut)
async def list_salespeople(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    total = await db.scalar(select(func.count()).select_from(SalespersonProfile))
    rows = (
        await db.execute(
            select(SalespersonProfile)
            .order_by(SalespersonProfile.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return SalespersonListOut(items=list(rows), total=int(total or 0), limit=limit, offset=offset)


@router.patch("/salespeople/{salesperson_id}", response_model=SalespersonOut)
async def update_salesperson(
    salesperson_id: UUID,
    payload: SalespersonUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)

    sp = await db.get(SalespersonProfile, salesperson_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Salesperson not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(sp, k, v)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflict updating salesperson")

    await db.refresh(sp)
    return sp


@router.post("/salespeople/{salesperson_id}/rotate-code", response_model=SalespersonOut)
async def rotate_salesperson_code(
    salesperson_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)

    sp = await db.get(SalespersonProfile, salesperson_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Salesperson not found")

    # collision-safe retry, relying on DB unique constraint
    for _ in range(MAX_CODE_RETRIES):
        sp.referral_code = _gen_referral_code()
        try:
            await db.commit()
            await db.refresh(sp)
            return sp
        except IntegrityError:
            await db.rollback()
            continue

    raise HTTPException(status_code=500, detail="Failed to rotate referral code; retry later")
