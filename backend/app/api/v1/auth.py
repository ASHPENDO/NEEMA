# backend/app/api/v1/auth.py
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import bearer_scheme, create_access_token, decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import MagicCodeRequest, MagicCodeVerify, MeResponse, ProfileUpdateRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

MAGIC_CODE_EXPIRY_MINUTES = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _should_return_magic_code_in_response() -> bool:
    """
    Production hardening:
    - In prod, never return the OTP in API responses.
    - In non-prod/dev environments, it can be returned to simplify Swagger testing.

    This is defensive (works even if your Settings doesn't have a dedicated flag).
    Prefer adding a setting like RETURN_MAGIC_CODE_IN_RESPONSE=False for prod later.
    """
    env = getattr(settings, "ENV", None) or getattr(settings, "ENVIRONMENT", None)
    if isinstance(env, str) and env.lower() in {"prod", "production"}:
        return False
    # If a dedicated toggle exists, honor it
    flag = getattr(settings, "RETURN_MAGIC_CODE_IN_RESPONSE", None)
    if isinstance(flag, bool):
        return flag
    return True


async def purge_expired_magic_codes(db: AsyncSession) -> None:
    """
    Clear all expired magic codes globally.
    """
    stmt = (
        update(User)
        .where(User.magic_code_expires_at.is_not(None))
        .where(User.magic_code_expires_at < _utcnow())
        .values(magic_code=None, magic_code_expires_at=None)
    )
    await db.execute(stmt)


@router.post("/request-code")
async def request_code(payload: MagicCodeRequest, db: AsyncSession = Depends(get_db)):
    """
    Body: {"email": "user@example.com"}
    Generates a magic code (stored on user record).

    NOTE: In production, do NOT return the code in the response.
    """
    email = payload.email.strip().lower()

    await purge_expired_magic_codes(db)

    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()

    if user is None:
        user = User(email=email, is_active=True)
        db.add(user)
        await db.flush()

    code = str(secrets.randbelow(900000) + 100000)  # 6 digits
    expires_at = _utcnow() + timedelta(minutes=MAGIC_CODE_EXPIRY_MINUTES)

    user.magic_code = code
    user.magic_code_expires_at = expires_at

    await db.commit()

    resp = {"status": "ok", "expires_in_minutes": MAGIC_CODE_EXPIRY_MINUTES}
    if _should_return_magic_code_in_response():
        resp["code"] = code
    return resp


@router.post("/verify-code", response_model=TokenResponse)
async def verify_code(payload: MagicCodeVerify, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    Body: {"email":"user@example.com","code":"123456"}
    Returns: access_token
    """
    email = payload.email.strip().lower()
    code = payload.code.strip()

    if not code:
        raise HTTPException(status_code=400, detail="code is required")

    await purge_expired_magic_codes(db)

    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()

    if not user or not user.magic_code or not user.magic_code_expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")

    if user.magic_code != code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")

    if user.magic_code_expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code expired")

    # One-time use: clear after successful verification
    user.magic_code = None
    user.magic_code_expires_at = None
    await db.commit()

    access_token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    return TokenResponse(access_token=access_token)


async def get_current_user(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency for protected endpoints.
    """
    token = credentials.credentials
    user_id = decode_access_token(token)  # returns sub string

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_uuid = uuid.UUID(str(user_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = await db.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    return user


def _to_me_response(user: User) -> MeResponse:
    return MeResponse(
        id=str(user.id),
        email=user.email,
        is_active=getattr(user, "is_active", True),
        full_name=user.full_name,
        phone_e164=user.phone_e164,
        country=user.country,
        profile_complete=user.is_profile_complete,
    )


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)) -> MeResponse:
    """
    Returns current user identity + profile completion.
    """
    return _to_me_response(user)


@router.patch("/me", response_model=MeResponse)
async def update_me(
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MeResponse:
    """
    Updates current user profile fields (post-login profile completion).
    """
    data = payload.model_dump(exclude_unset=True)

    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")

    # Defensive normalization at model-level (schemas already validate; this ensures consistency)
    if "full_name" in data:
        user.full_name = User.normalize_full_name(data["full_name"])

    if "phone_e164" in data:
        try:
            user.phone_e164 = User.normalize_phone_e164(data["phone_e164"])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    if "country" in data:
        try:
            user.country = User.normalize_country(data["country"])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _to_me_response(user)
