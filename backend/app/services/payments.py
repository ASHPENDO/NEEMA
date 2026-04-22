# app/services/payments.py
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.tenant import Tenant
from app.models.salesperson_earning_event import SalespersonEarningEvent
from app.models.salesperson_profile import SalespersonProfile
from app.core.sales_attribution import compute_commission_kes, utcnow


# ---------------------------------------------------------
# PUBLIC: Payment success hook
# ---------------------------------------------------------

async def handle_subscription_payment_success(
    *,
    db: AsyncSession,
    tenant_id,
    amount_kes: Decimal,
    source: str = "MPESA",  # or STRIPE / MANUAL
    metadata: Optional[dict] = None,
) -> None:
    """
    Central hook for ALL successful payments.

    Idempotent:
    - Uses external_ref (MpesaReceiptNumber / Stripe charge id)
    - Safe against retries and race conditions
    """

    # -----------------------------------------------------
    # 0. Extract idempotency key
    # -----------------------------------------------------
    external_ref = metadata.get("external_ref") if metadata else None

    # -----------------------------------------------------
    # 1. Load tenant
    # -----------------------------------------------------
    tenant: Tenant | None = await db.get(Tenant, tenant_id)
    if not tenant:
        return

    # -----------------------------------------------------
    # 2. Check attribution
    # -----------------------------------------------------
    if not tenant.salesperson_profile_id:
        return

    # -----------------------------------------------------
    # 3. Load salesperson
    # -----------------------------------------------------
    sp: SalespersonProfile | None = await db.get(
        SalespersonProfile,
        tenant.salesperson_profile_id,
    )

    if not sp or not sp.is_active:
        return

    # -----------------------------------------------------
    # 4. Early idempotency check (fast path)
    # -----------------------------------------------------
    if external_ref:
        stmt = select(SalespersonEarningEvent).where(
            SalespersonEarningEvent.external_ref == external_ref
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()

        if existing:
            return  # already processed

    # -----------------------------------------------------
    # 5. Compute commission
    # -----------------------------------------------------
    commission_amount = compute_commission_kes(
        tier=str(tenant.tier),
        gross_amount_kes=amount_kes,
    )

    if commission_amount <= 0:
        return

    # -----------------------------------------------------
    # 6. Create earning event
    # -----------------------------------------------------
    event = SalespersonEarningEvent(
        salesperson_profile_id=sp.id,
        tenant_id=tenant.id,
        event_type="SUBSCRIPTION_PAID",
        currency="KES",
        gross_amount=amount_kes,
        commission_amount=commission_amount,
        source=source,
        occurred_at=utcnow(),
        external_ref=external_ref,  # ✅ CRITICAL
        event_metadata=metadata or {},
    )

    # -----------------------------------------------------
    # 7. Commit safely (race-condition safe)
    # -----------------------------------------------------
    try:
        db.add(event)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return  # duplicate safely ignored


# ---------------------------------------------------------
# OPTIONAL: (deprecated) helper
# ---------------------------------------------------------

async def has_existing_payment_event(
    *,
    db: AsyncSession,
    tenant_id,
    external_ref: str,
) -> bool:
    """
    Deprecated: replaced by external_ref unique constraint.

    Kept for backward compatibility.
    """

    stmt = select(SalespersonEarningEvent).where(
        SalespersonEarningEvent.external_ref == external_ref
    )

    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None