# app/services/scheduler.py

import asyncio
from sqlalchemy import select, func

from app.db.session import async_session_maker
from app.models.campaign import Campaign

# 🔥 NEW
from app.tasks.campaign_tasks import execute_campaign_task


async def campaign_scheduler():
    while True:
        print("[SCHEDULER] Tick...")

        async with async_session_maker() as db:

            result = await db.execute(
                select(Campaign)
                .where(
                    Campaign.status.in_(["scheduled", "failed"]),
                    Campaign.scheduled_at <= func.now(),
                )
                .with_for_update(skip_locked=True)
            )

            campaigns = result.scalars().all()

            print(f"[SCHEDULER] Found {len(campaigns)} campaigns")

            for campaign in campaigns:
                try:
                    print(f"[QUEUE] Dispatching campaign {campaign.id}")

                    campaign.status = "queued"
                    await db.commit()

                    # 🔥 SEND TO CELERY WORKER
                    execute_campaign_task.delay(str(campaign.id))

                except Exception as e:
                    print(f"[SCHEDULER ERROR] {campaign.id}: {e}")

        await asyncio.sleep(10)