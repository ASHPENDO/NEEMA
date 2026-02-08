from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    bearer_scheme,
    create_access_token,
    decode_access_token,
)
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

MAGIC_CODE_EXPIRY_MINUTES = 10


# -----------------------------
# Swagger-friendly request models
# -----------------------------
class MagicCodeRequest(BaseModel):
    email: EmailStr


class MagicCodeVerify(BaseModel):
    email: EmailStr
    code: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
    Generates a magic code (currently stored on user record).
    Dev-only: returns code in response to simplify Swagger testing.
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

    return {"status": "ok", "expires_in_minutes": MAGIC_CODE_EXPIRY_MINUTES, "code": code}


@router.post("/verify-code")
async def verify_code(payload: MagicCodeVerify, db: AsyncSession = Depends(get_db)):
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

    # FIX: create_access_token expects (subject, expires_minutes)
    access_token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    return {"access_token": access_token, "token_type": "bearer"}


async def get_current_user(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency for protected endpoints.
    """
    token = credentials.credentials

    # IMPORTANT: decode_access_token returns the 'sub' string, not the full payload
    user_id = decode_access_token(token)

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    """
    Returns current user identity.
    """
    return {
        "id": str(user.id),
        "email": user.email,
        "is_active": getattr(user, "is_active", True),
    }
