# backend/app/routers/payments.py  (relevant snippets)
#
# Apply these blocks to your existing router file.

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.utils.phone import normalize_ke_phone
from app.services.payments import initiate_stk_push
from app.core.database import async_session_maker  # adjust import to your project

router = APIRouter()


# =========================
# 📲 STK PUSH ENDPOINT
# =========================
# ✅ Normalize at the boundary — services receive clean data
@router.post("/mpesa/stk-push")
async def stk_push(payload: STKPushRequest):
    try:
        normalized_phone = normalize_ke_phone(payload.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await initiate_stk_push(
        phone=normalized_phone,
        amount=payload.amount,
        tenant_id=payload.tenant_id,  # ✅ must be tenant_id, NOT user_id or membership_id
    )


# =========================
# 📩 CALLBACK ENDPOINT
# =========================
@router.post("/mpesa/callback")
async def mpesa_callback(request: Request):
    body = await request.json()

    # ... your existing get_value() helper and body parsing ...

    raw_phone = str(get_value("PhoneNumber"))

    # ✅ Normalize callback phone
    try:
        phone = normalize_ke_phone(raw_phone)
    except ValueError:
        print(f"[PHONE WARNING] Could not normalize: {raw_phone}")
        phone = raw_phone  # fallback — Safaricom should always send 254XXXXXXXXX

    async with async_session_maker() as db:

        # ✅ Issue 2 fix: match on billing_phone_number (not signup phone)
        result = await db.execute(
            select(Tenant).where(Tenant.billing_phone_number == phone)
        )
        tenant = result.scalar_one_or_none()

        # ⚠️ Fallback to legacy phone field for existing data
        if not tenant:
            result = await db.execute(
                select(Tenant).where(Tenant.phone_number == phone)
            )
            tenant = result.scalar_one_or_none()

        if not tenant:
            print(f"[CALLBACK ERROR] No tenant found for phone={phone}")
            return {"status": "tenant_not_found"}

        # ✅ Issue 3 fix: persist billing_phone AFTER finding tenant (not circular)
        tenant.billing_phone_number = phone

        # ✅ Activate subscription
        tenant.subscription_status = "active"
        tenant.subscription_ends_at = datetime.utcnow() + timedelta(days=365)

        await db.commit()

    return {"status": "ok"}