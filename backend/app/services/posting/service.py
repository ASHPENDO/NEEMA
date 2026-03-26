# app/services/posting/service.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from datetime import datetime

from app.models.social_account import SocialAccount
from app.models.post_history import PostHistory
from app.services.posting.registry import PLATFORM_REGISTRY


class PostService:

    @staticmethod
    async def publish(payload, tenant_id, db: AsyncSession):
        # 1. Validate platform
        poster = PLATFORM_REGISTRY.get(payload.platform)

        if not poster:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: {payload.platform}",
            )

        # 2. Fetch social account
        result = await db.execute(
            select(SocialAccount).where(
                SocialAccount.tenant_id == tenant_id,
                SocialAccount.provider == payload.platform,
                SocialAccount.page_id == payload.page_id,
            )
        )
        social_account = result.scalar_one_or_none()

        if not social_account:
            raise HTTPException(
                status_code=404,
                detail="Social account not found",
            )

        # 3. Create PostHistory (PENDING)
        history = PostHistory(
            tenant_id=tenant_id,
            platform=payload.platform,
            page_id=payload.page_id,
            caption=payload.caption,
            image_url=payload.image_url,
            status="pending",
        )

        db.add(history)
        await db.commit()
        await db.refresh(history)

        try:
            # 4. Execute platform post
            result = await poster.post(payload, social_account)

            # 5. Update success
            history.status = "success"
            history.external_post_id = result.get("post_id")
            history.posted_at = datetime.utcnow()

            await db.commit()

            return {
                "success": True,
                "data": result,
                "history_id": str(history.id),
            }

        except Exception as e:
            # 6. Update failure
            history.status = "failed"
            history.error_message = str(e)

            await db.commit()

            # Re-raise for API layer
            raise