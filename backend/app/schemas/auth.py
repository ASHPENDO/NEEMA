# backend/app/schemas/auth.py
from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

_E164_RE = re.compile(r"^\+[1-9]\d{1,14}$")


def _normalize_phone_e164(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    v = re.sub(r"[^\d+]", "", v)
    if not _E164_RE.match(v):
        raise ValueError("Must be a valid E.164 phone number (e.g., +254712345678).")
    return v


def _normalize_full_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = " ".join(value.strip().split())
    return v or None


def _normalize_country(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    v = v.upper()
    if not re.fullmatch(r"[A-Z]{2}", v):
        raise ValueError("Must be a 2-letter ISO country code (e.g., KE).")
    return v


class MagicCodeRequest(BaseModel):
    email: EmailStr


class MagicCodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=64)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Allow null to clear; reject empty strings via validators (normalize -> None)
    full_name: Optional[str] = Field(default=None, max_length=200)
    phone_e164: Optional[str] = Field(default=None, max_length=20)
    country: Optional[str] = Field(default=None, max_length=2)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_full_name(v)

    @field_validator("phone_e164")
    @classmethod
    def validate_phone_e164(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_phone_e164(v)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_country(v)


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    is_active: bool

    full_name: Optional[str] = None
    phone_e164: Optional[str] = None
    country: Optional[str] = None

    profile_complete: bool
