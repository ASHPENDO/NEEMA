from sqlalchemy.ext.asyncio import AsyncSession
from app.models.campaign import Campaign
from app.services.posting.service import PostService


class CampaignService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_campaign(self, tenant_id, data):
        campaign = Campaign(
            tenant_id=tenant_id,
            name=data.name,
            caption=data.caption,
            media_url=str(data.media_url),
            platforms=data.platforms,
            page_ids=data.page_ids,
            scheduled_at=data.scheduled_at,
            status="scheduled"
        )

        self.db.add(campaign)
        await self.db.commit()
        await self.db.refresh(campaign)

        return campaign

    async def execute_campaign(self, campaign: Campaign):
        post_service = PostService(self.db)

        result = await post_service.publish(
            tenant_id=campaign.tenant_id,
            platforms=campaign.platforms,
            content={
                "caption": campaign.caption,
                "media_url": campaign.media_url,
                "page_ids": campaign.page_ids
            }
        )

        campaign.status = "posted"
        await self.db.commit()

        return result