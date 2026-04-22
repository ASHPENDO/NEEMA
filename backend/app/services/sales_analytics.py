from __future__ import annotations

from datetime import timedelta
from typing import List, Dict, Any

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.salesperson_earning_event import SalespersonEarningEvent
from app.models.salesperson_profile import SalespersonProfile
from app.core.sales_attribution import utcnow


# ---------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------

async def get_sales_leaderboard(
    db: AsyncSession,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Returns top salespeople by total commission.
    """

    stmt = (
        select(
            SalespersonProfile.user_id,
            SalespersonProfile.referral_code,
            func.coalesce(func.sum(SalespersonEarningEvent.commission_amount), 0).label("total_commission"),
        )
        .join(
            SalespersonEarningEvent,
            SalespersonEarningEvent.salesperson_profile_id == SalespersonProfile.id,
        )
        .group_by(SalespersonProfile.id)
        .order_by(desc("total_commission"))
        .limit(limit)
    )

    rows = (await db.execute(stmt)).all()

    results = []
    for r in rows:
        results.append(
            {
                "user_id": str(r.user_id),
                "referral_code": r.referral_code,
                "total_commission": r.total_commission,
            }
        )

    return results


# ---------------------------------------------------------
# Individual Ranking
# ---------------------------------------------------------

async def get_salesperson_rank(
    db: AsyncSession,
    salesperson_profile_id,
) -> int | None:
    """
    Returns rank of a salesperson based on total commission.
    """

    subquery = (
        select(
            SalespersonEarningEvent.salesperson_profile_id,
            func.coalesce(func.sum(SalespersonEarningEvent.commission_amount), 0).label("total"),
        )
        .group_by(SalespersonEarningEvent.salesperson_profile_id)
        .subquery()
    )

    stmt = (
        select(subquery.c.salesperson_profile_id)
        .order_by(desc(subquery.c.total))
    )

    rows = (await db.execute(stmt)).scalars().all()

    for idx, sp_id in enumerate(rows, start=1):
        if sp_id == salesperson_profile_id:
            return idx

    return None


# ---------------------------------------------------------
# Time-based Performance
# ---------------------------------------------------------

async def get_sales_last_30_days(
    db: AsyncSession,
    salesperson_profile_id,
) -> Dict[str, Any]:
    """
    Returns last 30-day performance metrics.
    """

    since = utcnow() - timedelta(days=30)

    stmt = select(
        func.count(SalespersonEarningEvent.id),
        func.coalesce(func.sum(SalespersonEarningEvent.commission_amount), 0),
    ).where(
        SalespersonEarningEvent.salesperson_profile_id == salesperson_profile_id,
        SalespersonEarningEvent.occurred_at >= since,
    )

    events, total = (await db.execute(stmt)).one()

    return {
        "events": int(events or 0),
        "commission": total,
    }