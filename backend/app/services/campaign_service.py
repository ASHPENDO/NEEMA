from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.campaign import Campaign
from app.models.social_account import SocialAccount
from app.models.post_history import PostHistory

from app.services.posting.service import PostService
from app.services.posting.schemas import PostPayload

# 🔥 IMPORT FROM YOUR ADAPTER
from app.services.posting.platforms.facebook import (
    FacebookAPIException,
)


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
        WITH FAILURE HANDLING + ACCOUNT HEALTH TRACKING
        """

        all_success = True

        for platform, page_id in zip(campaign.platforms, campaign.page_ids):

            payload = PostPayload(
                platform=platform,
                page_id=page_id,
                caption=campaign.caption,
                image_url=campaign.media_url,
            )

            # 🔥 FETCH SOCIAL ACCOUNT (CRITICAL)
            result = await self.db.execute(
                select(SocialAccount).where(
                    SocialAccount.tenant_id == campaign.tenant_id,
                    SocialAccount.page_id == page_id,
                    SocialAccount.platform == platform,
                )
            )
            social_account = result.scalars().first()

            try:
                # 🔥 EXECUTE POST
                result = await PostService.publish(
                    payload=payload,
                    tenant_id=campaign.tenant_id,
                    db=self.db,
                )

                # ✅ SUCCESS → UPDATE HEALTH
                if social_account:
                    social_account.last_checked_at = datetime.now(timezone.utc)

                # ✅ RECORD SUCCESS
                post_history = PostHistory(
                    tenant_id=campaign.tenant_id,
                    platform=platform,
                    page_id=page_id,
                    caption=campaign.caption,
                    image_url=campaign.media_url,
                    status="success",
                    external_post_id=result.get("post_id"),
                    retry_count=0,
                    last_attempt_at=datetime.now(timezone.utc),
                )
                self.db.add(post_history)

            except FacebookAPIException as e:
                all_success = False

                print(f"[POST ERROR] {e.error_type} - {str(e)}")

                # 🔥 UPDATE SOCIAL ACCOUNT STATE
                if social_account:
                    social_account.status = "disconnected"
                    social_account.requires_reauth = True
                    social_account.last_error = str(e.raw or str(e))
                    social_account.last_checked_at = datetime.now(timezone.utc)

                # 🔥 RECORD FAILURE
                post_history = PostHistory(
                    tenant_id=campaign.tenant_id,
                    platform=platform,
                    page_id=page_id,
                    caption=campaign.caption,
                    image_url=campaign.media_url,
                    status="failed",
                    failure_reason=e.error_type,
                    error_message=str(e),
                    retry_count=1,
                    last_attempt_at=datetime.now(timezone.utc),
                )
                self.db.add(post_history)

            except Exception as e:
                all_success = False

                print(f"[UNKNOWN ERROR] {str(e)}")

                # 🔥 RECORD UNKNOWN FAILURE
                post_history = PostHistory(
                    tenant_id=campaign.tenant_id,
                    platform=platform,
                    page_id=page_id,
                    caption=campaign.caption,
                    image_url=campaign.media_url,
                    status="failed",
                    failure_reason="UNKNOWN",
                    error_message=str(e),
                    retry_count=1,
                    last_attempt_at=datetime.now(timezone.utc),
                )
                self.db.add(post_history)

        # 🔥 FINAL CAMPAIGN STATUS
        campaign.status = "posted" if all_success else "failed"

        await self.db.commit()

        return {
            "success": all_success
        }