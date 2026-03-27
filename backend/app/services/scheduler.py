# app/services/scheduler.py

import asyncio

from sqlalchemy import select, func

from app.db.session import async_session_maker
from app.models.campaign import Campaign
from app.services.campaign_service import CampaignService


async def campaign_scheduler():
    while True:
        print("[SCHEDULER] Tick...")

        async with async_session_maker() as db:

            # ✅ USE DB TIME + LOCK ROWS (CRITICAL)
            result = await db.execute(
                select(Campaign)
                .where(
                    Campaign.status == "scheduled",
                    Campaign.scheduled_at <= func.now(),
                )
                .with_for_update(skip_locked=True)  # 🔥 execution guard
            )

            campaigns = result.scalars().all()

            print(f"[SCHEDULER] Found {len(campaigns)} campaigns")

            for campaign in campaigns:
                service = CampaignService(db)

                try:
                    print(f"[SCHEDULER] Processing campaign {campaign.id}")

                    campaign.status = "processing"
                    await db.commit()

                    await service.execute_campaign(campaign)

                    print(f"[SCHEDULER] Campaign {campaign.id} completed")

                except Exception as e:
                    print(f"[SCHEDULER ERROR] Campaign {campaign.id} failed: {e}")

                    campaign.status = "failed"
                    await db.commit()

        await asyncio.sleep(10)