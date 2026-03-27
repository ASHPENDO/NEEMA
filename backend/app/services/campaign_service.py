from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.services.posting.service import PostService
from app.services.posting.schemas import PostPayload


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
            status="scheduled",
        )

        self.db.add(campaign)
        await self.db.commit()
        await self.db.refresh(campaign)

        return campaign

    async def execute_campaign(self, campaign: Campaign):
        """
        Executes campaign across all platforms/pages
        """

        for platform, page_id in zip(campaign.platforms, campaign.page_ids):
            payload = PostPayload(
                platform=platform,
                page_id=page_id,
                caption=campaign.caption,
                image_url=campaign.media_url,  # map media_url → image_url
            )

            await PostService.publish(
                payload=payload,
                tenant_id=campaign.tenant_id,
                db=self.db,
            )

        campaign.status = "posted"
        await self.db.commit()

        return {"success": True}