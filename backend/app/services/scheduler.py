from sqlalchemy import select
from datetime import datetime
from app.models.campaign import Campaign
from app.services.campaign_service import CampaignService


async def run_scheduler(db):
    while True:
        now = datetime.utcnow()

        result = await db.execute(
            select(Campaign).where(
                Campaign.status == "scheduled",
                Campaign.scheduled_at <= now
            )
        )

        campaigns = result.scalars().all()

        for campaign in campaigns:
            service = CampaignService(db)

            try:
                campaign.status = "processing"
                await db.commit()

                await service.execute_campaign(campaign)

            except Exception:
                campaign.status = "failed"
                await db.commit()

        await asyncio.sleep(10)