# app/services/posting/service.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from datetime import datetime, timezone

from app.core.config import settings

from app.models.social_account import SocialAccount
from app.models.post_history import PostHistory
from app.models.campaign import Campaign  # ✅ NEW

from app.services.posting.registry import PLATFORM_REGISTRY


class PostService:

    @staticmethod
    async def publish(payload, tenant_id, db: AsyncSession):
        results = []

        # ✅ OPTIONAL campaign_id (from scheduler)
        campaign_id = getattr(payload, "campaign_id", None)

        platforms = getattr(payload, "platforms", None) or [payload.platform]
        page_ids = getattr(payload, "page_ids", None) or [payload.page_id]

        caption = getattr(payload, "caption", None) or getattr(payload, "message", "")
        media_url = str(payload.image_url) if getattr(payload, "image_url", None) else None

        if not caption:
            raise HTTPException(status_code=400, detail="Caption/message is required")

        for platform in platforms:
            poster = PLATFORM_REGISTRY.get(platform)

            if not poster:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported platform: {platform}",
                )

            for page_id in page_ids:

                page_id_str = str(page_id).strip()

                print(f"[PostService] 🔍 Lookup: {platform} / {page_id_str}")
                print(f"[DEBUG] tenant_id={tenant_id}")

                result = await db.execute(
                    select(SocialAccount).where(
                        SocialAccount.tenant_id == tenant_id,
                        func.lower(SocialAccount.platform) == platform.lower(),
                        func.trim(SocialAccount.page_id) == page_id_str,
                    )
                )

                social_account = result.scalar_one_or_none()

                if not social_account:
                    print(f"[PostService] ❌ No account for {platform} / {page_id_str}")
                    results.append({
                        "platform": platform,
                        "page_id": page_id_str,
                        "status": "failed",
                        "error": "Social account not found",
                    })
                    continue

                print(f"[PostService] ✅ Account found")

                # -----------------------------
                # Create history (WITH campaign_id)
                # -----------------------------
                history = PostHistory(
                    tenant_id=tenant_id,
                    campaign_id=campaign_id,  # ✅ NEW
                    platform=platform,
                    page_id=page_id_str,
                    caption=caption,
                    image_url=media_url,
                    status="pending",
                )

                db.add(history)
                await db.commit()
                await db.refresh(history)

                try:
                    if settings.POSTING_MODE == "safe":
                        print(f"[SAFE MODE] Skipping real post → {platform} / {page_id_str}")

                        history.status = "skipped"
                        history.error_message = "Skipped due to safe mode"

                        await db.commit()

                        results.append({
                            "platform": platform,
                            "page_id": page_id_str,
                            "status": "skipped",
                            "reason": "safe_mode",
                        })

                        continue

                    print(f"[PostService] 🚀 Posting → {platform} / {page_id_str}")

                    result = await poster.post(payload, social_account)

                    print(f"[PostService] ✅ Success: {result}")

                    history.status = "success"
                    history.external_post_id = result.get("post_id")
                    history.posted_at = datetime.now(timezone.utc)

                    await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id_str,
                        "status": "success",
                        "history_id": str(history.id),
                        "post_id": result.get("post_id"),
                    })

                except Exception as e:
                    print(f"[PostService ERROR] {platform} / {page_id_str}: {e}")

                    await db.rollback()

                    history = await db.get(PostHistory, history.id)

                    if history:
                        history.status = "failed"
                        history.error_message = str(e)
                        await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id_str,
                        "status": "failed",
                        "error": str(e),
                    })

        # -----------------------------
        # FINAL: UPDATE CAMPAIGN STATUS ✅
        # -----------------------------
        if campaign_id:
            campaign = await db.get(Campaign, campaign_id)
            if campaign:
                if any(r["status"] == "success" for r in results):
                    campaign.status = "posted"
                else:
                    campaign.status = "failed"

                await db.commit()

        overall_success = any(r["status"] == "success" for r in results)

        return {
            "success": overall_success,
            "results": results,
        }