from app.core.celery_app import celery_app
from app.db.session import async_session_maker
from app.models.campaign import Campaign

from app.services.locks import acquire_lock, release_lock

import asyncio


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

            # 🔒 Prevent duplicate execution
            if not acquire_lock(lock_key):
                print(f"[LOCK] Skipping duplicate execution {campaign_id}")
                return

            try:
                print(f"[TASK] Executing campaign {campaign_id}")

                # ✅ SAFETY CHECK
                if campaign.status not in ["processing", "scheduled"]:
                    print(f"[TASK] Skipping campaign {campaign_id}, status={campaign.status}")
                    return

                # ==================================================
                # 🔥 CORE EXECUTION (TEMPORARY SIMULATION)
                # ==================================================

                print("[TASK] Simulating post...")

                # Future:
                # await publish_post(
                #     caption=campaign.caption,
                #     media_url=campaign.media_url,
                #     page_ids=campaign.page_ids,
                #     platforms=campaign.platforms,
                # )

                # ==================================================

                # ✅ MARK SUCCESS
                campaign.status = "posted"
                await db.commit()

                print(f"[TASK] Completed campaign {campaign_id}")

            except Exception as e:
                print(f"[TASK ERROR] {campaign_id}: {e}")

                # ❌ MARK FAILURE
                campaign.status = "failed"
                await db.commit()

                raise

            finally:
                release_lock(lock_key)

    try:
        # ✅ FIX: Create isolated event loop per task
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