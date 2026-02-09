from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from fastapi.security import HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=True)


def _normalize_token(token: str) -> str:
    """
    Make token decoding resilient to common Swagger / copy-paste issues:
    - Leading/trailing whitespace/newlines
    - Surrounding quotes
    - Accidentally including the 'Bearer ' prefix in the token field
    """
    if token is None:
        return ""

    t = token.strip()

    # remove surrounding quotes if present
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        t = t[1:-1].strip()

    # remove accidental bearer prefix
    if t.lower().startswith("bearer "):
        t = t[7:].strip()

    return t


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    expire_dt = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    # Use numeric timestamps for maximum compatibility
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": int(expire_dt.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }

    return jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> str:
    token = _normalize_token(token)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require_sub": True, "require_exp": True},
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return str(sub)
    except JWTError:
        # Includes expired signature, bad format, bad signature, wrong algorithm, etc.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
