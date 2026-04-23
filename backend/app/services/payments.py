from sqlalchemy import select
from decimal import Decimal
from app.models.salesperson_earning_event import SalespersonEarningEvent


async def handle_subscription_payment_success(
    db,
    tenant_id: str,
    amount_kes: Decimal,
    source: str,
    metadata: dict,
):
    external_ref = metadata.get("external_ref")

    # 🔒 1. IDEMPOTENCY GUARD (CRITICAL)
    if external_ref:
        existing = await db.execute(
            select(SalespersonEarningEvent).where(
                SalespersonEarningEvent.external_ref == external_ref
            )
        )
        if existing.scalar_one_or_none():
            print(f"[IDEMPOTENT] Skipping duplicate payment: {external_ref}")
            return

    # 🔍 2. FETCH TENANT
    from app.models.tenant import Tenant

    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        print(f"[ERROR] Tenant not found: {tenant_id}")
        return

    # 🔍 3. CHECK SALESPERSON LINK
    salesperson_id = tenant.salesperson_profile_id
    if not salesperson_id:
        print(f"[INFO] No salesperson linked → no commission")
        return

    # 🔍 4. CHECK SALESPERSON ACTIVE
    from app.models.salesperson_profile import SalespersonProfile

    sp_result = await db.execute(
        select(SalespersonProfile).where(
            SalespersonProfile.id == salesperson_id
        )
    )
    salesperson = sp_result.scalar_one_or_none()

    if not salesperson or not salesperson.is_active:
        print(f"[INFO] Salesperson inactive → no commission")
        return

    # 💰 5. COMMISSION CALCULATION (FIXED)
    # Example: 10% commission
    commission_rate = Decimal("0.10")
    commission_amount = amount_kes * commission_rate

    # 🧾 6. CREATE EARNING EVENT
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

    # 💾 7. COMMIT
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Commit failed (likely duplicate): {e}")
        return

    print(f"[SUCCESS] Commission recorded: {commission_amount}")