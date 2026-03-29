from app.core.celery_app import celery_app
from app.db.session import async_session_maker
from app.models.campaign import Campaign
from app.services.campaign_service import CampaignService

from app.services.locks import acquire_lock, release_lock


@celery_app.task(bind=True, max_retries=5)
def execute_campaign_task(self, campaign_id: str):
    import asyncio

    async def run():
        async with async_session_maker() as db:
            campaign = await db.get(Campaign, campaign_id)

            if not campaign:
                return

            lock_key = f"campaign:{campaign_id}"

            # 🔥 PREVENT DUPLICATE EXECUTION
            if not acquire_lock(lock_key):
                print(f"[LOCK] Skipping duplicate execution {campaign_id}")
                return

            try:
                service = CampaignService(db)
                await service.execute_campaign(campaign)

            finally:
                release_lock(lock_key)

    try:
        asyncio.run(run())

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)