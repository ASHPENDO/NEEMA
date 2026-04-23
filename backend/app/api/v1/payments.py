# backend/app/api/v1/payments.py

from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.db.session import async_session_maker
from app.services.payments import handle_subscription_payment_success

router = APIRouter()


@router.post("/mpesa/callback")
async def mpesa_callback(request: Request):
    """
    MPESA STK Push callback handler (Daraja API)

    This endpoint:
    1. Receives MPESA payment result
    2. Extracts key fields
    3. Calls idempotent payment handler
    """

    payload = await request.json()

    try:
        stk_callback = payload["Body"]["stkCallback"]

        result_code = stk_callback.get("ResultCode")
        checkout_request_id = stk_callback.get("CheckoutRequestID")

        # ❌ Payment failed → ignore safely
        if result_code != 0:
            print(f"[MPESA] Payment failed: {stk_callback}")
            return {"status": "ignored"}

        metadata_items = stk_callback["CallbackMetadata"]["Item"]

        # Convert metadata list → dict
        metadata = {}
        for item in metadata_items:
            name = item.get("Name")
            value = item.get("Value")
            metadata[name] = value

        amount = Decimal(str(metadata.get("Amount")))
        mpesa_receipt = metadata.get("MpesaReceiptNumber")
        phone = metadata.get("PhoneNumber")

        # ⚠️ CRITICAL: use CheckoutRequestID as idempotency key
        external_ref = checkout_request_id

        # TODO: Replace with real tenant lookup logic
        tenant_id = metadata.get("AccountReference")  # or map phone → tenant

        if not tenant_id:
            print("[MPESA] Missing tenant_id mapping")
            return {"status": "error", "reason": "missing tenant"}

        async with async_session_maker() as db:  # type: AsyncSession
            await handle_subscription_payment_success(
                db=db,
                tenant_id=tenant_id,
                amount_kes=amount,
                source="MPESA",
                metadata={
                    "receipt": mpesa_receipt,
                    "phone": phone,
                    "raw": payload,
                    "external_ref": external_ref,
                },
            )

        print(f"[MPESA] Payment processed: {external_ref}")

        return {"status": "success"}

    except Exception as e:
        print(f"[MPESA ERROR] {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")