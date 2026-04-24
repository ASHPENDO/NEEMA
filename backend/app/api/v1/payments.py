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

        # ❌ FAILED PAYMENT
        if result_code != 0:
            print(f"[MPESA FAILED] ResultCode={result_code}")
            return {"status": "failed"}

        metadata_items = stk_callback.get("CallbackMetadata", {}).get("Item", [])

        def get_value(name):
            for item in metadata_items:
                if item.get("Name") == name:
                    return item.get("Value")
            return None

        amount = get_value("Amount")
        receipt = get_value("MpesaReceiptNumber")
        phone = str(get_value("PhoneNumber"))

        # 🔥 CRITICAL: use AccountReference (tenant_id)
        tenant_id = stk_callback.get("AccountReference")

        if not tenant_id:
            print("[CALLBACK ERROR] Missing AccountReference (tenant_id)")
            return {"status": "missing_tenant"}

        async with async_session_maker() as db:

            # =========================
            # 🔍 FETCH TENANT
            # =========================
            result = await db.execute(
                select(Tenant).where(Tenant.id == tenant_id)
            )
            tenant = result.scalar_one_or_none()

            if not tenant:
                print(f"[CALLBACK] Tenant not found: {tenant_id}")
                return {"status": "tenant_not_found"}

            # =========================
            # 🔥 PERSIST PHONE (NEW)
            # =========================
            tenant.billing_phone_number = phone

            # =========================
            # ✅ ACTIVATE SUBSCRIPTION
            # =========================
            tenant.subscription_status = "active"
            tenant.subscription_ends_at = datetime.utcnow() + timedelta(days=365)

            print(f"[CALLBACK] Activated tenant {tenant.id}")

            # =========================
            # 💰 RECORD COMMISSION EVENT
            # =========================
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

            # 🔥 SINGLE COMMIT (VERY IMPORTANT)
            await db.commit()

        print(f"[MPESA SUCCESS] {checkout_request_id}")
        return {"status": "success"}

    except Exception as e:
        print(f"[MPESA ERROR] {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")