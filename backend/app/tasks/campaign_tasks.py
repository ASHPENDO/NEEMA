from app.core.celery_app import celery_app
from app.db.session import async_session_maker
from app.models.campaign import Campaign

from app.services.locks import acquire_lock, release_lock

from app.services.posting.service import PostService
from app.services.posting.schemas import PostPayload

from app.core.config import settings

import asyncio
import time


# ✅ GLOBAL EVENT LOOP
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)


@celery_app.task(
    bind=True,
    max_retries=5,
    name="app.tasks.campaign_tasks.execute_campaign_task",
)
def execute_campaign_task(self, campaign_id: str):

    async def run():

        # ==============================
        # SESSION 1 → FETCH CAMPAIGN
        # ==============================
        async with async_session_maker() as db:
            campaign = await db.get(Campaign, campaign_id)

            if not campaign:
                print(f"[TASK] Campaign not found: {campaign_id}")
                return

            # 🔥 STRICT GUARD (NO RE-RUN)
            if campaign.status != "processing":
                print(f"[TASK] Skipping campaign {campaign_id}, status={campaign.status}")
                return

            lock_key = f"campaign:{campaign_id}"

            if not acquire_lock(lock_key):
                print(f"[LOCK] Skipping duplicate execution {campaign_id}")
                return

            payload = PostPayload(
                caption=campaign.caption,
                image_url=campaign.media_url,
                page_id=campaign.page_ids[0],
                platform=campaign.platforms[0],
                page_ids=campaign.page_ids,
                platforms=campaign.platforms,
                campaign_id=str(campaign.id),
            )

            tenant_id = campaign.tenant_id

        try:
            print(f"[TASK] Executing campaign {campaign_id}")

            # ==============================
            # SAFE MODE
            # ==============================
            if settings.SAFE_MODE:

                if not settings.SAFE_ENABLE_SCHEDULER_POSTING:
                    print("[SAFE MODE] Scheduler posting disabled")
                    return

                allowed_pages = set(settings.SAFE_PAGE_IDS)
                campaign_pages = set(payload.page_ids or [])

                if not campaign_pages.issubset(allowed_pages):
                    print(f"[SAFE MODE] Blocked page_ids: {payload.page_ids}")
                    return

                print(f"[SAFE MODE] Waiting {settings.SAFE_POST_INTERVAL}s...")
                time.sleep(settings.SAFE_POST_INTERVAL)

            # ==============================
            # SESSION 2 → POSTING
            # ==============================
            result = {"success": False}

            async with async_session_maker() as db:
                try:
                    result = await PostService.publish(
                        payload=payload,
                        tenant_id=tenant_id,
                        db=db,
                    )
                except Exception as e:
                    print(f"[POST ERROR SAFE] {e}")

            print(f"[TASK] Post result: {result}")

            # ==============================
            # SESSION 3 → FINAL STATUS (ATOMIC)
            # ==============================
            async with async_session_maker() as db:
                campaign_db = await db.get(Campaign, campaign_id)

                if campaign_db:
                    campaign_db.status = "posted" if result.get("success") else "failed"
                    await db.commit()

            print(f"[TASK] Completed campaign {campaign_id}")

        except Exception as e:
            print(f"[TASK ERROR] {campaign_id}: {e}")

            # ==============================
            # SESSION 4 → FAILURE GUARANTEE
            # ==============================
            async with async_session_maker() as db:
                campaign_db = await db.get(Campaign, campaign_id)

                if campaign_db:
                    campaign_db.status = "failed"
                    await db.commit()

            raise

        finally:
            release_lock(lock_key)

    try:
        loop.run_until_complete(run())

    except Exception as exc:
        print(f"[TASK RETRY] {campaign_id}: {str(exc)}")

        raise self.retry(
            exc=exc,
            countdown=60,
        )