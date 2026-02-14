from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.models.platform_invitation import PlatformInvitation
from app.models.platform_membership import PlatformMembership
from app.models.salesperson_profile import SalespersonProfile
from app.models.user import User
from app.schemas.platform_invitation import (
    AssignSalespersonPayment,
    PlatformInviteAccept,
    PlatformInviteAcceptOut,
    PlatformInviteCreate,
    PlatformInviteOut,
    PlatformMembershipOut,
    SalespersonProfileOut,
)

router = APIRouter(prefix="/platform-invitations", tags=["platform-invitations"])

INVITE_EXPIRY_DAYS = 7

# Canonical platform roles
PLATFORM_ROLES = {"SUPER_ADMIN", "STAFF", "SALESPERSON"}

# Invitee types supported
INVITEE_TYPES = {"STAFF", "SALESPERSON"}

# Permission keys (checkboxes) — add as you grow
PERMISSIONS = {
    "INVITE_STAFF",
    "INVITE_SALESPEOPLE",
    "DELETE_PLATFORM_USERS",
    "ASSIGN_SALES_PAYMENTS",
    "VIEW_SALES_DASHBOARD_ADMIN",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def generate_token() -> str:
    return secrets.token_urlsafe(48)


def generate_referral_code() -> str:
    # 6 chars: A-Z + 0-9
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


async def _get_platform_membership(db: AsyncSession, user_id) -> Optional[PlatformMembership]:
    stmt = select(PlatformMembership).where(PlatformMembership.user_id == user_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def _require_super_admin(m: PlatformMembership | None) -> None:
    if not m or not m.is_active or (m.role or "").upper() != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role: SUPER_ADMIN required",
        )


def _require_any_platform_admin(m: PlatformMembership | None) -> None:
    # SUPER_ADMIN or STAFF
    if not m or not m.is_active or (m.role or "").upper() not in {"SUPER_ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role: SUPER_ADMIN or STAFF required",
        )


def _require_permission(m: PlatformMembership | None, perm: str) -> None:
    """
    Permission gate with SUPER_ADMIN override.
    """
    if not m or not m.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform membership inactive or missing",
        )

    if (m.role or "").upper() == "SUPER_ADMIN":
        return

    perms = set((m.permissions or []))
    if perm not in perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {perm}",
        )


# =========================================================
# Create + list invitations (admin/staff)
# =========================================================

@router.post("", response_model=PlatformInviteOut, status_code=status.HTTP_201_CREATED)
async def create_platform_invitation(
    payload: PlatformInviteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a platform invitation.

    Policy (as agreed):
    - SUPER_ADMIN can invite STAFF or SALESPERSON (full access).
    - STAFF cannot invite STAFF.
    - STAFF can invite SALESPERSON only if they have INVITE_SALESPEOPLE permission.
    """
    membership = await _get_platform_membership(db, user.id)

    invitee_type = (payload.invitee_type or "").strip().upper()
    if invitee_type not in INVITEE_TYPES:
        raise HTTPException(status_code=400, detail="invitee_type must be STAFF or SALESPERSON")

    email = normalize_email(payload.email)
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    # Determine target role
    target_role = (payload.role or "").strip().upper()
    if invitee_type == "STAFF":
        target_role = target_role or "STAFF"
        if target_role != "STAFF":
            raise HTTPException(status_code=400, detail="STAFF invite must have role=STAFF")
    else:
        target_role = "SALESPERSON"

    # Authorization rules
    if invitee_type == "STAFF":
        # Strict: only SUPER_ADMIN can invite STAFF
        _require_super_admin(membership)
    else:
        # SALESPERSON: SUPER_ADMIN can always invite; STAFF needs INVITE_SALESPEOPLE
        _require_any_platform_admin(membership)
        _require_permission(membership, "INVITE_SALESPEOPLE")

    # Validate permissions assigned to STAFF (checkbox delegations)
    perms = payload.permissions or []
    if invitee_type == "STAFF":
        unknown = [p for p in perms if p not in PERMISSIONS]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail={"message": "Unknown permission keys", "unknown": unknown},
            )
    else:
        # Salespeople don't get delegated permissions like staff
        if perms:
            raise HTTPException(status_code=400, detail="Salesperson invitations do not accept permissions")

    # Prevent duplicate active invitations for same email
    existing_stmt = (
        select(PlatformInvitation)
        .where(PlatformInvitation.email == email)
        .where(PlatformInvitation.accepted_at.is_(None))
        .where(PlatformInvitation.expires_at > _utcnow())
    )
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Active invitation already exists for this email")

    inv = PlatformInvitation(
        email=email,
        invitee_type=invitee_type,
        role=target_role,
        permissions=perms if invitee_type == "STAFF" else [],
        token=generate_token(),
        expires_at=_utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
        created_by_user_id=user.id,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.get("", response_model=List[PlatformInviteOut])
async def list_platform_invitations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List platform invitations (SUPER_ADMIN + STAFF).
    """
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)

    stmt = select(PlatformInvitation).order_by(PlatformInvitation.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


# =========================================================
# Accept invitation (public)
# =========================================================

@router.post("/accept", response_model=PlatformInviteAcceptOut)
async def accept_platform_invitation(
    payload: PlatformInviteAccept,
    db: AsyncSession = Depends(get_db),
):
    """
    Public accept by token.
    - Requires accept_tos == True
    - Creates user if missing (email-only)
    - Creates PlatformMembership
    - If SALESPERSON: creates SalespersonProfile with referral_code (6 chars)
    """
    if payload.accept_tos is not True:
        raise HTTPException(status_code=400, detail="accept_tos must be true")

    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    stmt = select(PlatformInvitation).where(PlatformInvitation.token == token)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    now = _utcnow()
    if inv.expires_at < now:
        raise HTTPException(status_code=410, detail="Invitation has expired")

    if inv.accepted_at is not None:
        raise HTTPException(status_code=409, detail="Invitation already accepted")

    # Create or load user by invitation email
    email = normalize_email(inv.email)
    ustmt = select(User).where(User.email == email)
    ures = await db.execute(ustmt)
    user = ures.scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        await db.flush()

    # Create or update platform membership
    mstmt = select(PlatformMembership).where(PlatformMembership.user_id == user.id)
    mres = await db.execute(mstmt)
    membership = mres.scalar_one_or_none()

    role = (inv.role or "").strip().upper()
    if role not in PLATFORM_ROLES:
        raise HTTPException(status_code=400, detail="Invalid platform role in invitation")

    if membership is None:
        membership = PlatformMembership(
            user_id=user.id,
            role=role,
            permissions=inv.permissions or [],
            is_active=True,
            accepted_terms=True,
            notifications_opt_in=payload.accept_notifications,
        )
        db.add(membership)
    else:
        membership.role = role
        membership.permissions = inv.permissions or []
        membership.is_active = True
        membership.accepted_terms = True
        membership.notifications_opt_in = payload.accept_notifications

    # If salesperson: ensure profile + referral code
    salesperson_profile_out = None
    if (inv.invitee_type or "").upper() == "SALESPERSON":
        sp_stmt = select(SalespersonProfile).where(SalespersonProfile.user_id == user.id)
        sp_res = await db.execute(sp_stmt)
        sp = sp_res.scalar_one_or_none()

        if sp is None:
            # ensure unique referral code via retry
            for _ in range(10):
                code = generate_referral_code()
                exists_stmt = select(SalespersonProfile).where(SalespersonProfile.referral_code == code)
                exists_res = await db.execute(exists_stmt)
                if exists_res.scalar_one_or_none() is None:
                    sp = SalespersonProfile(user_id=user.id, referral_code=code, is_active=True)
                    db.add(sp)
                    break
            if sp is None:
                raise HTTPException(status_code=500, detail="Could not allocate unique referral code")
        else:
            sp.is_active = True

        salesperson_profile_out = SalespersonProfileOut(
            user_id=str(user.id),
            referral_code=sp.referral_code,
            is_active=sp.is_active,
        )

    inv.accepted_at = now
    inv.accepted_by_user_id = user.id

    await db.commit()

    return PlatformInviteAcceptOut(
        ok=True,
        user_id=str(user.id),
        role=membership.role,
        permissions=membership.permissions or [],
        accepted_terms=membership.accepted_terms,
        notifications_opt_in=membership.notifications_opt_in,
        salesperson_profile=salesperson_profile_out,
    )


# =========================================================
# Admin operations (delete users / assign payments)
# =========================================================

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_platform_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    SUPER_ADMIN can delete staff/salesperson.
    STAFF can delete only if permission DELETE_PLATFORM_USERS is granted.
    """
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)
    _require_permission(membership, "DELETE_PLATFORM_USERS")

    # deactivate platform membership
    stmt = select(PlatformMembership).where(PlatformMembership.user_id == user_id)
    res = await db.execute(stmt)
    pm = res.scalar_one_or_none()
    if pm:
        pm.is_active = False

    # deactivate salesperson profile if exists
    sp_stmt = select(SalespersonProfile).where(SalespersonProfile.user_id == user_id)
    sp_res = await db.execute(sp_stmt)
    sp = sp_res.scalar_one_or_none()
    if sp:
        sp.is_active = False

    await db.commit()
    return None


@router.post("/salespeople/{user_id}/assign-payment", status_code=status.HTTP_200_OK)
async def assign_salesperson_payment(
    user_id: str,
    payload: AssignSalespersonPayment,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Stub for later Daraja STK push wiring.
    Requires ASSIGN_SALES_PAYMENTS permission (or SUPER_ADMIN).
    """
    membership = await _get_platform_membership(db, user.id)
    _require_any_platform_admin(membership)
    _require_permission(membership, "ASSIGN_SALES_PAYMENTS")

    sp_stmt = select(SalespersonProfile).where(SalespersonProfile.user_id == user_id)
    sp_res = await db.execute(sp_stmt)
    sp = sp_res.scalar_one_or_none()
    if not sp:
        raise HTTPException(status_code=404, detail="Salesperson profile not found")

    # Store/track last assigned amount & phone (optional)
    sp.last_payment_amount = payload.amount
    sp.last_payment_phone = payload.phone
    sp.last_payment_assigned_at = _utcnow()

    await db.commit()
    return {"ok": True, "user_id": user_id, "amount": payload.amount, "phone": payload.phone}
