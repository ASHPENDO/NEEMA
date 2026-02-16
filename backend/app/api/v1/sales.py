from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.sales import require_salesperson
from app.db.session import get_db
from app.models.salesperson_profile import SalespersonProfile
from app.models.salesperson_earning_event import SalespersonEarningEvent
from app.models.tenant import Tenant
from app.schemas.sales import SalesMeOut, SalesStatsOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/me", response_model=SalesMeOut)
async def get_sales_me(
    sp: SalespersonProfile = Depends(require_salesperson),
):
    return SalesMeOut(
        user_id=str(sp.user_id),
        salesperson_profile_id=str(sp.id),
        referral_code=sp.referral_code,
        is_active=sp.is_active,
        created_at=sp.created_at,
    )


@router.get("/me/stats", response_model=SalesStatsOut)
async def get_sales_stats(
    db: AsyncSession = Depends(get_db),
    sp: SalespersonProfile = Depends(require_salesperson),
):
    # Total clients attributed to this salesperson
    total_clients = (
        await db.execute(
            select(func.count())
            .select_from(Tenant)
            .where(Tenant.salesperson_profile_id == sp.id)
        )
    ).scalar_one()

    active_clients = (
        await db.execute(
            select(func.count())
            .select_from(Tenant)
            .where(Tenant.salesperson_profile_id == sp.id)
            .where(Tenant.is_active.is_(True))
        )
    ).scalar_one()

    # Earnings total from ledger
    earnings_total = (
        await db.execute(
            select(func.coalesce(func.sum(SalespersonEarningEvent.amount), 0))
            .where(SalespersonEarningEvent.salesperson_profile_id == sp.id)
        )
    ).scalar_one()

    return SalesStatsOut(
        total_clients=int(total_clients or 0),
        active_clients=int(active_clients or 0),
        earnings_total=float(earnings_total or 0),
        earnings_currency="KES",
    )
