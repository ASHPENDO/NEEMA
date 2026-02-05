from pydantic import BaseModel, EmailStr, Field


class MagicCodeRequest(BaseModel):
    email: EmailStr


class MagicCodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=64)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: str
    email: EmailStr
