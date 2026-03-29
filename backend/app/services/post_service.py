# app/services/post_service.py

from datetime import datetime, timezone

async def publish_to_facebook(
    db: AsyncSession,
    social_account: SocialAccount,
    campaign,
):
    try:
        result = await facebook_adapter.post(
            access_token=social_account.access_token,
            page_id=social_account.account_id,
            message=campaign.content,
        )

        # SUCCESS
        social_account.last_checked_at = datetime.now(timezone.utc)

        return {"status": "success", "post_id": result["id"]}

    except Exception as e:
        error_data = getattr(e, "response_json", {}) or {}
        error_type = classify_facebook_error(error_data)

        # UPDATE SOCIAL ACCOUNT STATE
        social_account.status = "disconnected"
        social_account.requires_reauth = True
        social_account.last_error = str(error_data)
        social_account.last_checked_at = datetime.now(timezone.utc)

        # RECORD FAILURE
        post_history = PostHistory(
            campaign_id=campaign.id,
            social_account_id=social_account.id,
            status="failed",
            failure_reason=error_type,
            retry_count=1,
            last_attempt_at=datetime.now(timezone.utc),
        )

        db.add(post_history)
        await db.commit()

        return {"status": "failed", "reason": error_type}