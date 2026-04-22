# app/api/v1/mpesa.py
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.services.payments import handle_subscription_payment_success

router = APIRouter(prefix="/mpesa", tags=["mpesa"])


@router.post("/callback")
async def mpesa_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Safaricom Daraja STK Push callback.

    Idempotent:
    - Uses MpesaReceiptNumber as external_ref
    - Duplicate callbacks are safely ignored
    """

    payload: Dict[str, Any] = await request.json()

    try:
        stk = payload["Body"]["stkCallback"]

        # ---------------------------------------------------------
        # 1. Check result
        # ---------------------------------------------------------
        result_code = stk.get("ResultCode")
        if result_code != 0:
            return {"ok": False, "reason": "Payment failed"}

        # ---------------------------------------------------------
        # 2. Extract metadata
        # ---------------------------------------------------------
        metadata_items = stk["CallbackMetadata"]["Item"]
        meta = {item["Name"]: item.get("Value") for item in metadata_items}

        amount = Decimal(str(meta.get("Amount", 0)))
        receipt = meta.get("MpesaReceiptNumber")  # 🔑 idempotency key
        phone = str(meta.get("PhoneNumber"))
        tenant_id = meta.get("AccountReference")

        if not receipt:
            return {"ok": False, "error": "Missing MpesaReceiptNumber"}

        if not tenant_id:
            return {"ok": False, "error": "Missing AccountReference (tenant_id)"}

        # ---------------------------------------------------------
        # 3. Call payment handler (IDEMPOTENT)
        # ---------------------------------------------------------
        try:
            await handle_subscription_payment_success(
                db=db,
                tenant_id=tenant_id,
                amount_kes=amount,
                source="MPESA",
                metadata={
                    "external_ref": receipt,
                    "phone": phone,
                },
            )

        except IntegrityError:
            # ✅ Duplicate receipt → already processed
            await db.rollback()
            return {"ok": True, "status": "duplicate_ignored"}

        # ---------------------------------------------------------
        # 4. Success
        # ---------------------------------------------------------
        return {"ok": True}

    except Exception as e:
        # Never crash MPESA callback
        return {"ok": False, "error": str(e)}