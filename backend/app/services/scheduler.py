# app/services/scheduler.py

import asyncio

from sqlalchemy import select, func

from app.db.session import async_session_maker
from app.models.campaign import Campaign
from app.models.social_account import SocialAccount
from app.services.campaign_service import CampaignService


async def campaign_scheduler():
    while True:
        print("[SCHEDULER] Tick...")

        async with async_session_maker() as db:

            result = await db.execute(
                select(Campaign)
                .where(
                    Campaign.status == "scheduled",
                    Campaign.scheduled_at <= func.now(),
                )
                .with_for_update(skip_locked=True)
            )

            campaigns = result.scalars().all()

            print(f"[SCHEDULER] Found {len(campaigns)} campaigns")

            for campaign in campaigns:
                service = CampaignService(db)

                try:
                    print(f"[SCHEDULER] Processing campaign {campaign.id}")

                    # 🔥 FETCH SOCIAL ACCOUNT
                    social_account = await db.get(
                        SocialAccount, campaign.social_account_id
                    )

                    # 🔥 GUARD (CRITICAL)
                    if (
                        not social_account
                        or social_account.requires_reauth
                        or social_account.status != "active"
                    ):
                        print(
                            f"[SCHEDULER] Skipping campaign {campaign.id} - account requires reconnect"
                        )
                        continue

                    campaign.status = "processing"
                    await db.commit()

                    await service.execute_campaign(campaign)

                    print(f"[SCHEDULER] Campaign {campaign.id} completed")

                except Exception as e:
                    print(f"[SCHEDULER ERROR] Campaign {campaign.id} failed: {e}")

                    campaign.status = "failed"
                    await db.commit()

        await asyncio.sleep(10)