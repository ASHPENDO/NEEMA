from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import MagicCodeRequest, MagicCodeVerify, TokenResponse, MeResponse
from app.core.security import create_access_token, decode_access_token, bearer_scheme

router = APIRouter(prefix="/auth", tags=["auth"])

MAGIC_CODE_EXPIRY_MINUTES = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _generate_code() -> str:
    # 6-digit numeric code (dev-friendly)
    return f"{secrets.randbelow(1_000_000):06d}"


@router.post("/request-code")
async def request_code(payload: MagicCodeRequest, db: AsyncSession = Depends(get_db)) -> dict:
    email = _normalize_email(payload.email)
    code = _generate_code()
    expires_at = _utcnow() + timedelta(minutes=MAGIC_CODE_EXPIRY_MINUTES)

    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()

    if user is None:
        user = User(email=email, magic_code=code, magic_code_expires_at=expires_at)
        db.add(user)
    else:
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(magic_code=code, magic_code_expires_at=expires_at)
        )

    await db.commit()

    # DEV MODE: return code in response. Later replace with real email sending.
    return {"message": "Magic code generated", "dev_code": code, "expires_in_minutes": MAGIC_CODE_EXPIRY_MINUTES}


@router.post("/verify-code", response_model=TokenResponse)
async def verify_code(payload: MagicCodeVerify, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    email = _normalize_email(payload.email)
    code = payload.code.strip()

    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()

    if not user or not user.magic_code or not user.magic_code_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")

    if user.magic_code != code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")

    if user.magic_code_expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expired")

    # Clear code after successful verification
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(magic_code=None, magic_code_expires_at=None)
    )
    await db.commit()

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(creds=Depends(bearer_scheme), db: AsyncSession = Depends(get_db)) -> MeResponse:
    user_id = decode_access_token(creds.credentials)

    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return MeResponse(id=str(user.id), email=user.email)
