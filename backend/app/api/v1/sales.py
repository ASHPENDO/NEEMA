# app/api/v1/sales.py
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.sales import require_salesperson
from app.core.sales_attribution import utcnow
from app.db.session import get_db
from app.models.salesperson_earning_event import SalespersonEarningEvent
from app.models.salesperson_profile import SalespersonProfile
from app.schemas.sales import EarningsPageOut, EarningEventOut, SalesStatsOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/me/earnings", response_model=EarningsPageOut)
async def list_my_earnings(
    db: AsyncSession = Depends(get_db),
    sp: SalespersonProfile = Depends(require_salesperson),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Salesperson earnings ledger (immutable).
    Pagination:
      - limit (1..100)
      - offset (>=0)
    """
    total_stmt = select(func.count()).select_from(SalespersonEarningEvent).where(
        SalespersonEarningEvent.salesperson_profile_id == sp.id
    )
    total = (await db.execute(total_stmt)).scalar_one()

    stmt = (
        select(SalespersonEarningEvent)
        .where(SalespersonEarningEvent.salesperson_profile_id == sp.id)
        .order_by(SalespersonEarningEvent.occurred_at.desc(), SalespersonEarningEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items: list[EarningEventOut] = []
    for e in rows:
        items.append(
            EarningEventOut(
                id=str(e.id),
                salesperson_profile_id=str(e.salesperson_profile_id),
                tenant_id=str(e.tenant_id) if e.tenant_id else None,
                event_type=e.event_type,
                currency=e.currency,
                gross_amount=e.gross_amount,
                commission_amount=e.commission_amount,
                source=e.source,
                occurred_at=e.occurred_at,
                created_at=e.created_at,
                event_metadata=e.event_metadata or {},
            )
        )

    return EarningsPageOut(items=items, limit=limit, offset=offset, total=int(total))


@router.get("/me/stats", response_model=SalesStatsOut)
async def get_my_sales_stats(
    db: AsyncSession = Depends(get_db),
    sp: SalespersonProfile = Depends(require_salesperson),
):
    """
    Salesperson stats derived from the immutable ledger.
    """
    # totals
    totals_stmt = select(
        func.count(SalespersonEarningEvent.id),
        func.coalesce(func.sum(SalespersonEarningEvent.commission_amount), 0),
        func.max(SalespersonEarningEvent.occurred_at),
    ).where(SalespersonEarningEvent.salesperson_profile_id == sp.id)

    total_events, total_commission, last_event_at = (await db.execute(totals_stmt)).one()

    # last 30 days
    since = utcnow() - timedelta(days=30)
    last30_stmt = select(
        func.count(SalespersonEarningEvent.id),
        func.coalesce(func.sum(SalespersonEarningEvent.commission_amount), 0),
    ).where(
        SalespersonEarningEvent.salesperson_profile_id == sp.id,
        SalespersonEarningEvent.occurred_at >= since,
    )

    last_30d_events, last_30d_commission = (await db.execute(last30_stmt)).one()

    return SalesStatsOut(
        salesperson_profile_id=str(sp.id),
        total_events=int(total_events or 0),
        total_commission=total_commission,
        last_30d_events=int(last_30d_events or 0),
        last_30d_commission=last_30d_commission,
        last_event_at=last_event_at,
    )
