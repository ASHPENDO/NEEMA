# app/services/posting/platforms/facebook.py

import httpx


# 🔥 ERROR TYPES
class FacebookErrorType:
    ACCOUNT_RESTRICTED = "ACCOUNT_RESTRICTED"  # 368
    TOKEN_INVALID = "TOKEN_INVALID"            # 190
    UNKNOWN = "UNKNOWN"


# 🔥 CUSTOM EXCEPTION (CRITICAL)
class FacebookAPIException(Exception):
    def __init__(self, message, code=None, error_type=None, raw=None):
        super().__init__(message)
        self.code = code
        self.error_type = error_type
        self.raw = raw


def classify_facebook_error(error: dict) -> str:
    code = error.get("code")

    if code == 368:
        return FacebookErrorType.ACCOUNT_RESTRICTED
    elif code == 190:
        return FacebookErrorType.TOKEN_INVALID

    return FacebookErrorType.UNKNOWN


class FacebookAdapter:
    async def post(self, payload, social_account):
        """
        Posts to a Facebook Page:
        - Image + caption → /photos
        - Caption only → /feed
        """

        page_id = str(social_account.page_id).strip()
        access_token = social_account.page_access_token

        if not page_id or not access_token:
            raise FacebookAPIException(
                "Missing page_id or page_access_token",
                error_type=FacebookErrorType.UNKNOWN,
            )

        caption = payload.caption or ""

        image_url = (
            str(payload.image_url).strip()
            if getattr(payload, "image_url", None)
            else None
        )

        async with httpx.AsyncClient(timeout=30.0) as client:

            if image_url:
                url = f"https://graph.facebook.com/v19.0/{page_id}/photos"
                data = {
                    "url": image_url,
                    "caption": caption,
                    "access_token": access_token,
                }
            else:
                url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
                data = {
                    "message": caption,
                    "access_token": access_token,
                }

            response = await client.post(url, data=data)

        # 🔥 STRUCTURED ERROR HANDLING
        if response.status_code != 200:
            try:
                error_data = response.json()
                error = error_data.get("error", {})

                error_message = error.get("message")
                error_code = error.get("code")

                error_type = classify_facebook_error(error)

                raise FacebookAPIException(
                    message=f"Facebook API error: {error_message}",
                    code=error_code,
                    error_type=error_type,
                    raw=error_data,
                )

            except ValueError:
                raise FacebookAPIException(
                    message=f"Facebook API error: {response.text}",
                    error_type=FacebookErrorType.UNKNOWN,
                )

        # ✅ SAFE RESPONSE PARSING
        try:
            result = response.json()
        except Exception:
            raise FacebookAPIException(
                "Invalid JSON response from Facebook",
                error_type=FacebookErrorType.UNKNOWN,
            )

        post_id = result.get("post_id") or result.get("id")

        if not post_id:
            raise FacebookAPIException(
                f"Unexpected Facebook response: {result}",
                error_type=FacebookErrorType.UNKNOWN,
            )

        return {
            "post_id": post_id
        }