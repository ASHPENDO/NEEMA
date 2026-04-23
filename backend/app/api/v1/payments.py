# backend/app/api/v1/payments.py

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.db.session import async_session_maker
from app.services.payments import (
    handle_subscription_payment_success,
    initiate_stk_push,
)

router = APIRouter()


# =========================
# 📲 REQUEST MODEL (FIX)
# =========================
class STKPushRequest(BaseModel):
    phone: str
    amount: int
    tenant_id: str


# =========================
# 📲 STK PUSH ENDPOINT (FIXED)
# =========================
@router.post("/mpesa/stk-push")
async def stk_push(payload: STKPushRequest):
    return await initiate_stk_push(
        phone=payload.phone,
        amount=payload.amount,
        tenant_id=payload.tenant_id,
    )


# =========================
# 🔁 CALLBACK
# =========================
@router.post("/mpesa/callback")
async def mpesa_callback(request: Request):
    payload = await request.json()

    try:
        stk_callback = payload["Body"]["stkCallback"]

        result_code = stk_callback.get("ResultCode")
        checkout_request_id = stk_callback.get("CheckoutRequestID")

        if result_code != 0:
            print(f"[MPESA FAILED] {stk_callback}")
            return {"status": "ignored"}

        metadata_items = stk_callback["CallbackMetadata"]["Item"]

        metadata = {item["Name"]: item.get("Value") for item in metadata_items}

        amount = Decimal(str(metadata.get("Amount")))
        receipt = metadata.get("MpesaReceiptNumber")
        phone = metadata.get("PhoneNumber")
        tenant_id = metadata.get("AccountReference")

        if not tenant_id:
            return {"status": "error", "reason": "missing tenant"}

        async with async_session_maker() as db:  # type: AsyncSession
            await handle_subscription_payment_success(
                db=db,
                tenant_id=tenant_id,
                amount_kes=amount,
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
        raise HTTPException(status_code=500, detail="Webhook failed")