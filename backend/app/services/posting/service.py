# app/services/posting/service.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from datetime import datetime, timezone

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

        # Normalize payload (support both single + multi)
        platforms = (
            payload.platforms
            if hasattr(payload, "platforms")
            else [payload.platform]
        )

        page_ids = (
            payload.page_ids
            if hasattr(payload, "page_ids")
            else [payload.page_id]
        )

        for platform in platforms:
            poster = PLATFORM_REGISTRY.get(platform)

            if not poster:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported platform: {platform}",
                )

            for page_id in page_ids:

                print(f"[PostService] Looking up account: {platform} / {page_id}")

                result = await db.execute(
                    select(SocialAccount).where(
                        SocialAccount.tenant_id == tenant_id,
                        SocialAccount.platform == platform,
                        SocialAccount.page_id == page_id,
                    )
                )
                social_account = result.scalars().first()

                if not social_account:
                    print(f"[PostService] ❌ No social account for {platform} / {page_id}")
                    continue

                print(f"[PostService] ✅ Social account found")

                # ✅ FIX: Convert URL → string
                image_url_str = (
                    str(payload.image_url) if getattr(payload, "image_url", None) else None
                )

                history = PostHistory(
                    tenant_id=tenant_id,
                    platform=platform,
                    page_id=page_id,
                    caption=payload.caption,
                    image_url=image_url_str,
                    status="pending",
                )

                try:
                    # 🔥 Wrap everything in one transaction block
                    db.add(history)
                    await db.commit()
                    await db.refresh(history)

                    print(f"[PostService] 🚀 Posting to {platform} / {page_id}")

                    result = await poster.post(payload, social_account)

                    print(f"[PostService] ✅ Post success: {result}")

                    history.status = "success"
                    history.external_post_id = result.get("post_id")
                    history.posted_at = datetime.now(timezone.utc)

                    await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id,
                        "status": "success",
                        "history_id": str(history.id),
                    })

                except Exception as e:
                    print(f"[PostService ERROR] {platform} / {page_id}: {e}")

                    # 🔥 CRITICAL: reset broken transaction
                    await db.rollback()

                    # Re-attach history safely
                    history.status = "failed"
                    history.error_message = str(e)

                    db.add(history)
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