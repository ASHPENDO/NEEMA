# app/services/posting/service.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
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

        # -----------------------------
        # 🔍 DEBUG: DATABASE INSPECTION
        # -----------------------------
        try:
            # Count rows
            count_result = await db.execute(text("SELECT COUNT(*) FROM social_accounts"))
            count = count_result.scalar()

            # Fetch all accounts
            all_result = await db.execute(select(SocialAccount))
            all_accounts = all_result.scalars().all()

            print(f"[DEBUG] DB COUNT social_accounts: {count}")
            print(f"[DEBUG] ALL ACCOUNTS: {all_accounts}")

        except Exception as e:
            print(f"[DEBUG ERROR] DB inspection failed: {e}")

        # -----------------------------
        # Normalize payload
        # -----------------------------
        platforms = getattr(payload, "platforms", None) or [payload.platform]
        page_ids = getattr(payload, "page_ids", None) or [payload.page_id]

        caption = getattr(payload, "caption", None) or getattr(payload, "message", "")
        image_url = str(payload.image_url) if getattr(payload, "image_url", None) else None

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

                # -----------------------------
                # 🔍 DEBUG: RAW QUERY CHECK
                # -----------------------------
                raw_check = await db.execute(
                    select(SocialAccount).where(
                        func.trim(SocialAccount.page_id) == page_id_str
                    )
                )
                raw_accounts = raw_check.scalars().all()
                print(f"[DEBUG] RAW MATCH (page_id only): {raw_accounts}")

                # -----------------------------
                # ✅ MAIN QUERY
                # -----------------------------
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
                # Create history
                # -----------------------------
                history = PostHistory(
                    tenant_id=tenant_id,
                    platform=platform,
                    page_id=page_id_str,
                    caption=caption,
                    image_url=image_url,
                    status="pending",
                )

                db.add(history)
                await db.commit()
                await db.refresh(history)

                try:
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

                    history.status = "failed"
                    history.error_message = str(e)

                    db.add(history)
                    await db.commit()

                    results.append({
                        "platform": platform,
                        "page_id": page_id_str,
                        "status": "failed",
                        "error": str(e),
                    })

        return {
            "success": True,
            "results": results,
        }