# backend/app/tasks/scheduler.py

import asyncio
from datetime import datetime
from sqlalchemy import select, func, or_

from app.db.session import async_session_maker
from app.models.campaign import Campaign
from app.models.tenant import Tenant
from app.tasks.campaign_tasks import execute_campaign_task


# =========================
# ⏰ TRIAL EXPIRY
# =========================
async def expire_trials(db):
    now = datetime.utcnow()

    result = await db.execute(
        select(Tenant).where(
            Tenant.subscription_status == "trial",
            Tenant.trial_ends_at < now,
        )
    )
    tenants = result.scalars().all()

    for tenant in tenants:
        tenant.subscription_status = "expired"
        print(f"[TRIAL EXPIRED] Tenant {tenant.id}")

    if tenants:
        await db.commit()


# =========================
# ⏰ SUBSCRIPTION EXPIRY
# =========================
async def expire_subscriptions(db):
    now = datetime.utcnow()

    result = await db.execute(
        select(Tenant).where(
            Tenant.subscription_status == "active",
            Tenant.subscription_ends_at < now,
        )
    )
    tenants = result.scalars().all()

    for tenant in tenants:
        tenant.subscription_status = "expired"
        print(f"[SUBSCRIPTION EXPIRED] Tenant {tenant.id}")

    if tenants:
        await db.commit()


# =========================
# 📅 MAIN SCHEDULER LOOP
# =========================
async def campaign_scheduler():
    while True:
        print("[SCHEDULER] Tick...")

        async with async_session_maker() as db:

            # ── 1. Trial expiry ─────────────────────────────────────────
            await expire_trials(db)

            # ── 2. Subscription expiry ──────────────────────────────────
            # Scheduler ONLY marks status. Payment is user-initiated via
            # the /mpesa/stk-push endpoint — never auto-triggered here.
            await expire_subscriptions(db)

            # ── 3. Campaign dispatch ────────────────────────────────────
            result = await db.execute(
                select(Campaign)
                .where(
                    Campaign.status == "scheduled",
                    or_(
                        Campaign.scheduled_at == None,
                        Campaign.scheduled_at <= func.now(),
                    )
                )
                .with_for_update(skip_locked=True)
            )
            campaigns = result.scalars().all()

            print(f"[SCHEDULER] Found {len(campaigns)} campaigns")

            for campaign in campaigns:
                try:
                    # 🔥 HARD GUARD (prevents ghost re-dispatch)
                    if campaign.status != "scheduled":
                        continue

                    print(f"[SCHEDULER] Tenant {campaign.tenant_id} → Campaign {campaign.id}")

                    campaign.status = "processing"
                    campaign.last_attempt_at = func.now()
                    await db.commit()

                    execute_campaign_task.delay(
                        campaign_id=str(campaign.id)
                    )

                except Exception as e:
                    print(f"[SCHEDULER ERROR] {campaign.id}: {e}")

        await asyncio.sleep(10)