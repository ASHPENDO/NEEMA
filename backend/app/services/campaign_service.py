from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.campaign import Campaign
from app.models.social_account import SocialAccount
from app.models.post_history import PostHistory

from app.services.posting.service import PostService
from app.services.posting.schemas import PostPayload

from app.services.posting.platforms.facebook import FacebookAPIException

# 🔥 NEW
from app.services.posting.retry import can_retry, next_retry_time
from app.services.posting.idempotency import build_idempotency_key


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
        ELITE VERSION:
        - Idempotent posting
        - Retry with backoff
        - Controlled failure escalation
        """

        all_success = True

        for platform, page_id in zip(campaign.platforms, campaign.page_ids):

            idem_key = build_idempotency_key(
                campaign.tenant_id,
                platform,
                page_id,
                campaign.id,
            )

            # 🔥 IDEMPOTENCY CHECK (SKIP DUPLICATES)
            existing = await self.db.execute(
                select(PostHistory).where(
                    PostHistory.tenant_id == campaign.tenant_id,
                    PostHistory.platform == platform,
                    PostHistory.page_id == page_id,
                    PostHistory.idempotency_key == idem_key,
                    PostHistory.status == "success",
                )
            )
            if existing.scalars().first():
                print(f"[SKIP] Already posted (idempotent): {idem_key}")
                continue

            payload = PostPayload(
                platform=platform,
                page_id=page_id,
                caption=campaign.caption,
                image_url=campaign.media_url,
            )

            # 🔥 FETCH SOCIAL ACCOUNT
            result = await self.db.execute(
                select(SocialAccount).where(
                    SocialAccount.tenant_id == campaign.tenant_id,
                    SocialAccount.page_id == page_id,
                    SocialAccount.platform == platform,
                )
            )
            social_account = result.scalars().first()

            try:
                res = await PostService.publish(
                    payload=payload,
                    tenant_id=campaign.tenant_id,
                    db=self.db,
                )

                # ✅ SUCCESS
                if social_account:
                    social_account.last_checked_at = datetime.now(timezone.utc)

                self.db.add(
                    PostHistory(
                        tenant_id=campaign.tenant_id,
                        platform=platform,
                        page_id=page_id,
                        caption=campaign.caption,
                        image_url=campaign.media_url,
                        status="success",
                        external_post_id=res.get("post_id"),
                        retry_count=0,
                        idempotency_key=idem_key,
                        last_attempt_at=datetime.now(timezone.utc),
                    )
                )

            except FacebookAPIException as e:
                all_success = False

                print(f"[POST ERROR] {e.error_type} - {str(e)}")

                # 🔥 GET LAST FAILURE
                existing_fail = await self.db.execute(
                    select(PostHistory).where(
                        PostHistory.idempotency_key == idem_key
                    )
                )
                existing_fail = existing_fail.scalars().first()

                retry_count = (existing_fail.retry_count + 1) if existing_fail else 1

                # 🔥 FINAL FAILURE → DISCONNECT
                if not can_retry(retry_count):
                    if social_account:
                        social_account.status = "disconnected"
                        social_account.requires_reauth = True
                        social_account.last_error = str(e)
                        social_account.last_checked_at = datetime.now(timezone.utc)

                self.db.add(
                    PostHistory(
                        tenant_id=campaign.tenant_id,
                        platform=platform,
                        page_id=page_id,
                        caption=campaign.caption,
                        image_url=campaign.media_url,
                        status="failed",
                        failure_reason=e.error_type,
                        error_message=str(e),
                        retry_count=retry_count,
                        idempotency_key=idem_key,
                        last_attempt_at=next_retry_time(retry_count),
                    )
                )

            except Exception as e:
                all_success = False

                print(f"[UNKNOWN ERROR] {str(e)}")

                self.db.add(
                    PostHistory(
                        tenant_id=campaign.tenant_id,
                        platform=platform,
                        page_id=page_id,
                        caption=campaign.caption,
                        image_url=campaign.media_url,
                        status="failed",
                        failure_reason="UNKNOWN",
                        error_message=str(e),
                        retry_count=1,
                        idempotency_key=idem_key,
                        last_attempt_at=next_retry_time(1),
                    )
                )

        campaign.status = "posted" if all_success else "failed"
        await self.db.commit()

        return {"success": all_success}