# backend/app/api/v1/payments.py

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.tenant import Tenant
from app.services.payments import (
    handle_subscription_payment_success,
    initiate_stk_push,
)

router = APIRouter()


# =========================
# 📲 REQUEST MODEL
# =========================
class STKPushRequest(BaseModel):
    phone: str
    amount: int
    tenant_id: str


# =========================
# 📲 STK PUSH ENDPOINT
# =========================
@router.post("/mpesa/stk-push")
async def stk_push(payload: STKPushRequest):
    return await initiate_stk_push(
        phone=payload.phone,
        amount=payload.amount,
        tenant_id=payload.tenant_id,
    )


# =========================
# 🔁 MPESA CALLBACK
# =========================
@router.post("/mpesa/callback")
async def mpesa_callback(request: Request):
    payload = await request.json()

    print("=== MPESA CALLBACK ===")
    print(payload)

    try:
        stk_callback = payload["Body"]["stkCallback"]
        result_code = stk_callback.get("ResultCode")
        checkout_request_id = stk_callback.get("CheckoutRequestID")

        # ❌ Failed payment — acknowledge and exit
        if result_code != 0:
            print(f"[MPESA FAILED] ResultCode={result_code} | {stk_callback}")
            return {"status": "failed"}

        metadata_items = stk_callback.get("CallbackMetadata", {}).get("Item", [])

        def get_value(name):
            for item in metadata_items:
                if item["Name"] == name:
                    return item.get("Value")
            return None

        amount  = get_value("Amount")
        receipt = get_value("MpesaReceiptNumber")
        phone   = get_value("PhoneNumber")

        async with async_session_maker() as db:
            # ── Look up tenant by phone number ──────────────────────────
            # Callback doesn't return tenant_id reliably, so match by phone
            result = await db.execute(
                select(Tenant).where(Tenant.phone_number == str(phone))
            )
            tenant = result.scalar_one_or_none()

            if not tenant:
                print(f"[CALLBACK] Tenant not found for phone={phone}")
                return {"status": "tenant_not_found"}

            # ✅ Activate subscription
            tenant.subscription_status = "active"
            tenant.subscription_ends_at = datetime.utcnow() + timedelta(days=365)
            await db.commit()

            print(f"[CALLBACK] Subscription activated for tenant {tenant.id}")

            # ── Record commission event ──────────────────────────────────
            await handle_subscription_payment_success(
                db=db,
                tenant_id=str(tenant.id),
                amount_kes=Decimal(str(amount)),
                source="MPESA",
                metadata={
                    "receipt": receipt,
                    "phone": phone,
                    "raw": payload,
                    "external_ref": checkout_request_id,
                },
            )

        print(f"[MPESA SUCCESS] {checkout_request_id}")
        return {"status": "success"}

    except Exception as e:
        print(f"[MPESA ERROR] {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")