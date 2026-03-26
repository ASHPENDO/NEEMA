# app/services/scheduler.py

import asyncio
from datetime import datetime
from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.campaign import Campaign
from app.services.posting.service import PostService


async def campaign_scheduler():
    while True:
        async with async_session_factory() as db:

            result = await db.execute(
                select(Campaign).where(Campaign.scheduled_at <= datetime.utcnow())
            )
            campaigns = result.scalars().all()

            for campaign in campaigns:
                payload = {
                    "platform": campaign.platform,
                    "page_id": campaign.page_id,
                    "caption": campaign.caption,
                    "image_url": campaign.image_url,
                }

                try:
                    await PostService.publish(payload, campaign.tenant_id, db)

                    # Optional: delete or mark executed
                    await db.delete(campaign)
                    await db.commit()

                except Exception:
                    continue

        await asyncio.sleep(30)  # check every 30s