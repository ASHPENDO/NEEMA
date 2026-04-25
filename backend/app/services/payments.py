# backend/app/services/payments.py

import base64
import httpx
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select

from app.core.config import settings
from app.models.salesperson_earning_event import SalespersonEarningEvent


# =========================
# 🔐 MPESA AUTH
# =========================
async def get_mpesa_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

    auth = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()

    headers = {
        "Authorization": f"Basic {auth}"
    }

    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        res.raise_for_status()
        return res.json()["access_token"]


# =========================
# 🔐 PASSWORD GENERATOR
# =========================
def generate_mpesa_password():
    # ✅ Force East Africa Time (UTC+3)
    now = datetime.utcnow() + timedelta(hours=3)
    timestamp = now.strftime("%Y%m%d%H%M%S")

    shortcode = str(settings.MPESA_SHORTCODE).strip()
    passkey = settings.MPESA_PASSKEY.strip()

    data = f"{shortcode}{passkey}{timestamp}"
    password = base64.b64encode(data.encode()).decode()

    print("=== MPESA DEBUG ===")
    print("SHORTCODE:", repr(shortcode))
    print("TIMESTAMP:", timestamp)
    print("PASSWORD:", password)

    return password, timestamp


# =========================
# 📲 STK PUSH
# =========================
async def initiate_stk_push(phone: str, amount: int, tenant_id: str, db):
    token = await get_mpesa_access_token()
    password, timestamp = generate_mpesa_password()

    # phone is already normalized at the API boundary (router)
    url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

    payload = {
        "BusinessShortCode": str(settings.MPESA_SHORTCODE).strip(),
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": str(settings.MPESA_SHORTCODE).strip(),
        "PhoneNumber": phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL.strip(),
        "AccountReference": tenant_id,  # ✅ used by callback to look up tenant
        "TransactionDesc": "POSTIKA Subscription"
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers)

        print("MPESA STATUS:", res.status_code)
        print("MPESA RESPONSE:", res.text)

        data = res.json()

    checkout_request_id = data.get("CheckoutRequestID")

    if not checkout_request_id:
        print(f"[STK ERROR] No CheckoutRequestID in response: {data}")
        raise ValueError("Safaricom did not return a CheckoutRequestID")

    # =========================
    # 💾 WRITE PENDING LEDGER ROW
    # =========================
    from uuid import uuid4
    from app.models.payment import Payment

    payment = Payment(
        id=str(uuid4()),
        tenant_id=tenant_id,
        checkout_request_id=checkout_request_id,
        phone=phone,
        amount=amount,
        status="pending",
    )
    db.add(payment)
    await db.commit()

    print(f"[STK] Pending payment created: {checkout_request_id}")

    return {
        "checkout_request_id": checkout_request_id,
        "merchant_request_id": data.get("MerchantRequestID"),
        "response_code": data.get("ResponseCode"),
        "response_description": data.get("ResponseDescription"),
        "customer_message": data.get("CustomerMessage"),
    }


# =========================
# 💰 PAYMENT HANDLER
# =========================
async def handle_subscription_payment_success(
    db,
    tenant_id: str,
    amount_kes: Decimal,
    source: str,
    metadata: dict,
):
    external_ref = metadata.get("external_ref")

    # 🔒 IDEMPOTENCY
    if external_ref:
        existing = await db.execute(
            select(SalespersonEarningEvent).where(
                SalespersonEarningEvent.external_ref == external_ref
            )
        )
        if existing.scalar_one_or_none():
            print(f"[IDEMPOTENT] Skipping duplicate payment: {external_ref}")
            return

    from app.models.tenant import Tenant
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        print(f"[ERROR] Tenant not found: {tenant_id}")
        return

    salesperson_id = tenant.salesperson_profile_id
    if not salesperson_id:
        print("[INFO] No salesperson linked → no commission")
        return

    from app.models.salesperson_profile import SalespersonProfile
    sp_result = await db.execute(
        select(SalespersonProfile).where(SalespersonProfile.id == salesperson_id)
    )
    salesperson = sp_result.scalar_one_or_none()

    if not salesperson or not salesperson.is_active:
        print("[INFO] Salesperson inactive → no commission")
        return

    commission_rate = Decimal("0.10")
    commission_amount = amount_kes * commission_rate

    event = SalespersonEarningEvent(
        salesperson_profile_id=salesperson_id,
        tenant_id=tenant_id,
        event_type="SUBSCRIPTION_PAYMENT",
        gross_amount=amount_kes,
        commission_amount=commission_amount,
        source=source,
        external_ref=external_ref,
        metadata=metadata,
    )

    db.add(event)

    # ✅ No commit here — caller (router) owns the transaction boundary
    print(f"[COMMISSION] Queued: {commission_amount} for salesperson {salesperson_id}")