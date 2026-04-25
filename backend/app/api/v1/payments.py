# backend/app/api/v1/payments.py

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, async_session_maker
from app.models.tenant import Tenant
from app.models.payment import Payment
from app.services.payments import (
    handle_subscription_payment_success,
    initiate_stk_push,
)
from app.utils.phone import normalize_ke_phone
from app.core.deps import get_current_tenant  # adjust path to your project

router = APIRouter()


# =========================
# 📲 REQUEST MODEL
# =========================
class STKPushRequest(BaseModel):
    phone: str
    amount: int
    tenant_id: str


# =========================
# 📋 LIST PAYMENTS ENDPOINT
# =========================
@router.get("/")
async def list_payments(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant.id)
        .order_by(Payment.created_at.desc())
    )

    payments = result.scalars().all()

    return [
        {
            "id": p.id,
            "amount": p.amount,
            "status": p.status,
            "phone": p.phone,
            "receipt": p.mpesa_receipt_number,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]


# =========================
# 📲 STK PUSH ENDPOINT
# =========================
# ✅ Normalize at boundary; pass db so service can write pending Payment row
@router.post("/mpesa/stk-push")
async def stk_push(
    payload: STKPushRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        normalized_phone = normalize_ke_phone(payload.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await initiate_stk_push(
        phone=normalized_phone,
        amount=payload.amount,
        tenant_id=payload.tenant_id,  # must be tenant_id, NOT user_id
        db=db,
    )


# =========================
# 📊 PAYMENT STATUS ENDPOINT
# =========================
# Frontend polls this after STK push to get deterministic success/failure
@router.get("/status/{checkout_request_id}")
async def get_payment_status(
    checkout_request_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment).where(
            Payment.checkout_request_id == checkout_request_id
        )
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    return {
        "status": payment.status,           # pending | success | failed
        "result_code": payment.result_code,
        "result_desc": payment.result_desc,
    }


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

        async with async_session_maker() as db:

            # =========================
            # 🔍 FIND PAYMENT ROW FIRST
            # =========================
            payment_result = await db.execute(
                select(Payment).where(
                    Payment.checkout_request_id == checkout_request_id
                )
            )
            payment = payment_result.scalar_one_or_none()

            # ❌ FAILED PAYMENT — update ledger and stop
            if result_code != 0:
                print(f"[MPESA FAILED] ResultCode={result_code}")
                if payment:
                    payment.status = "failed"
                    payment.result_code = result_code
                    payment.result_desc = stk_callback.get("ResultDesc")
                    payment.raw_callback = payload
                    await db.commit()
                return {"status": "failed"}

            # ✅ SUCCESSFUL PAYMENT — extract metadata
            metadata_items = stk_callback.get("CallbackMetadata", {}).get("Item", [])

            def get_value(name):
                for item in metadata_items:
                    if item.get("Name") == name:
                        return item.get("Value")
                return None

            amount = int(get_value("Amount") or 0)
            receipt = get_value("MpesaReceiptNumber")
            raw_phone = str(get_value("PhoneNumber"))

            try:
                phone = normalize_ke_phone(raw_phone)
            except ValueError:
                print(f"[PHONE WARNING] Could not normalize: {raw_phone}")
                phone = raw_phone  # Safaricom should always send 254XXXXXXXXX

            # AccountReference holds tenant_id (set during STK push)
            tenant_id = stk_callback.get("AccountReference")

            if not tenant_id:
                print("[CALLBACK ERROR] Missing AccountReference (tenant_id)")
                return {"status": "missing_tenant"}

            # =========================
            # ✅ UPDATE PAYMENT LEDGER
            # =========================
            if payment:
                payment.status = "success"
                payment.result_code = result_code
                payment.result_desc = "Success"
                payment.mpesa_receipt_number = receipt
                payment.raw_callback = payload
            else:
                # Safaricom fired callback before STK response was committed (rare race)
                # Insert the row now so polling still resolves correctly
                print(f"[CALLBACK WARNING] No Payment row for {checkout_request_id} — inserting fallback")
                from uuid import uuid4
                payment = Payment(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    checkout_request_id=checkout_request_id,
                    phone=phone,
                    amount=amount,
                    status="success",
                    result_code=result_code,
                    result_desc="Success",
                    mpesa_receipt_number=receipt,
                    raw_callback=payload,
                )
                db.add(payment)

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
            # 🔥 PERSIST BILLING PHONE
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

            # 🔥 SINGLE COMMIT — everything above lands atomically
            await db.commit()

        print(f"[MPESA SUCCESS] {checkout_request_id}")
        return {"status": "success"}

    except Exception as e:
        print(f"[MPESA ERROR] {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")