from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.models.campaign import Campaign


class CampaignService:
    """
    Service wrapper to maintain compatibility with scheduler/tasks.
    """

    @staticmethod
    async def create_campaign(db: AsyncSession, tenant_id, data):
        if data.scheduled_at:
            status = "scheduled"
        else:
            status = "draft"

        campaign = Campaign(
            tenant_id=tenant_id,

            # CORE LINKS
            product_id=data.product_id,
            template_id=data.template_id,

            # OPTIONAL
            name=getattr(data, "name", None),

            # DEFAULTS (SUNGURA)
            platforms=getattr(data, "platforms", ["facebook"]),
            page_ids=getattr(data, "page_ids", []),

            # CONTENT
            caption=data.caption,
            media_url=data.media_url,

            # SCHEDULING
            scheduled_at=data.scheduled_at,

            # STATUS
            status=status,

            # TIMESTAMPS
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)

        return campaign