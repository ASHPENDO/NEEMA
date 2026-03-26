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
        """
        Supports:
        - Single platform (API)
        - Multi-platform (Campaign execution)
        """

        results = []

        # Normalize to lists
        platforms = payload.platforms if hasattr(payload, "platforms") else [payload.platform]
        page_ids = payload.page_ids if hasattr(payload, "page_ids") else [payload.page_id]

        for platform in platforms:
            poster = PLATFORM_REGISTRY.get(platform)

            if not poster:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported platform: {platform}",
                )

            for page_id in page_ids:
                # Fetch social account
                result = await db.execute(
                    select(SocialAccount).where(
                        SocialAccount.tenant_id == tenant_id,
                        SocialAccount.provider == platform,
                        SocialAccount.page_id == page_id,
                    )
                )
                social_account = result.scalar_one_or_none()

                if not social_account:
                    continue  # skip invalid connections instead of failing entire campaign

                # Create PostHistory
                history = PostHistory(
                    tenant_id=tenant_id,
                    platform=platform,
                    page_id=page_id,
                    caption=payload.caption,
                    image_url=payload.image_url,
                    status="pending",
                )

                db.add(history)
                await db.commit()
                await db.refresh(history)

                try:
                    # Execute post
                    result = await poster.post(payload, social_account)

                    history.status = "success"
                    history.external_post_id = result.get("post_id")
                    history.posted_at = datetime.utcnow()

                    await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id,
                        "status": "success",
                        "history_id": str(history.id),
                    })

                except Exception as e:
                    history.status = "failed"
                    history.error_message = str(e)

                    await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id,
                        "status": "failed",
                        "error": str(e),
                    })

        return {
            "success": True,
            "results": results,
        }