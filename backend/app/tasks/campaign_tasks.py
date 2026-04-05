from app.core.celery_app import celery_app
from app.db.session import async_session_maker
from app.models.campaign import Campaign

from app.services.locks import acquire_lock, release_lock

from app.services.posting.service import PostService
from app.services.posting.schemas import PostPayload

from app.core.config import settings

import asyncio
import time


@celery_app.task(
    bind=True,
    max_retries=5,
    name="app.tasks.campaign_tasks.execute_campaign_task",
)
def execute_campaign_task(self, campaign_id: str):

    async def run():
        async with async_session_maker() as db:
            campaign = await db.get(Campaign, campaign_id)

            if not campaign:
                print(f"[TASK] Campaign not found: {campaign_id}")
                return

            lock_key = f"campaign:{campaign_id}"

            if not acquire_lock(lock_key):
                print(f"[LOCK] Skipping duplicate execution {campaign_id}")
                return

            try:
                print(f"[TASK] Executing campaign {campaign_id}")

                if campaign.status not in ["processing", "scheduled"]:
                    print(f"[TASK] Skipping campaign {campaign_id}, status={campaign.status}")
                    return

                # ==================================================
                # 🔐 SAFE MODE GUARDS
                # ==================================================
                if settings.SAFE_MODE:

                    # Block scheduler execution
                    if not settings.SAFE_ENABLE_SCHEDULER_POSTING:
                        print("[SAFE MODE] Scheduler posting disabled")
                        return

                    # Page whitelist check
                    allowed_pages = set(settings.SAFE_PAGE_IDS)
                    campaign_pages = set(campaign.page_ids or [])

                    if not campaign_pages.issubset(allowed_pages):
                        print(f"[SAFE MODE] Blocked page_ids: {campaign.page_ids}")
                        return

                    # Human-like delay
                    print(f"[SAFE MODE] Waiting {settings.SAFE_POST_INTERVAL}s before posting...")
                    time.sleep(settings.SAFE_POST_INTERVAL)

                # ==================================================
                # 🔥 REAL POSTING
                # ==================================================
                payload = PostPayload(
                    caption=campaign.caption,
                    media_url=campaign.media_url,
                    page_ids=campaign.page_ids,
                    platforms=campaign.platforms,
                )

                result = await PostService.publish(
                    payload=payload,
                    tenant_id=campaign.tenant_id,
                    db=db,
                )

                print(f"[TASK] Post result: {result}")

                # ==================================================

                campaign.status = "posted"
                await db.commit()

                print(f"[TASK] Completed campaign {campaign_id}")

            except Exception as e:
                print(f"[TASK ERROR] {campaign_id}: {e}")

                campaign.status = "failed"
                await db.commit()

                raise

            finally:
                release_lock(lock_key)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run())
        loop.close()

    except Exception as exc:
        print(f"[TASK RETRY] {campaign_id}: {str(exc)}")

        raise self.retry(
            exc=exc,
            countdown=60,
        )