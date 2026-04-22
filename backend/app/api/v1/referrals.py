from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.sales_attribution import (
    normalize_referral_code,
    resolve_salesperson_by_referral_code,
)
from app.schemas.referral import ReferralValidateIn, ReferralValidateOut

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.post("/validate", response_model=ReferralValidateOut)
async def validate_referral_code(
    payload: ReferralValidateIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate a referral code during signup.

    Does NOT create attribution — only verifies existence.
    """

    code = normalize_referral_code(payload.referral_code)

    if not code:
        return ReferralValidateOut(valid=False)

    sp = await resolve_salesperson_by_referral_code(db, code)

    if not sp:
        return ReferralValidateOut(valid=False)

    return ReferralValidateOut(
        valid=True,
        referral_code=sp.referral_code,
        salesperson_user_id=str(sp.user_id),
    )