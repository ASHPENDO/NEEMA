# app/services/posting/platforms/facebook.py

import httpx


class FacebookAdapter:
    async def post(self, payload, social_account):
        """
        Posts to a Facebook Page:
        - Image + caption → /photos
        - Caption only → /feed
        """

        page_id = str(social_account.page_id).strip()

        # 🔥 MUST be PAGE ACCESS TOKEN
        access_token = social_account.page_access_token

        if not page_id or not access_token:
            raise Exception("Missing page_id or page_access_token")

        caption = payload.caption or ""

        image_url = (
            str(payload.image_url).strip()
            if getattr(payload, "image_url", None)
            else None
        )

        async with httpx.AsyncClient(timeout=30.0) as client:

            # ✅ IMAGE POST
            if image_url:
                url = f"https://graph.facebook.com/v19.0/{page_id}/photos"

                data = {
                    "url": image_url,
                    "caption": caption,
                    "access_token": access_token,
                }

            # ✅ TEXT-ONLY POST
            else:
                url = f"https://graph.facebook.com/v19.0/{page_id}/feed"

                data = {
                    "message": caption,
                    "access_token": access_token,
                }

            response = await client.post(url, data=data)

        # 🔥 HANDLE FACEBOOK ERRORS PROPERLY
        if response.status_code != 200:
            try:
                error_data = response.json()
                error = error_data.get("error", {})
                error_message = error.get("message")
                error_code = error.get("code")

                raise Exception(
                    f"Facebook API error (code {error_code}): {error_message}"
                )

            except Exception:
                raise Exception(f"Facebook API error: {response.text}")

        # ✅ SAFE RESPONSE PARSING
        try:
            result = response.json()
        except Exception:
            raise Exception("Invalid JSON response from Facebook")

        post_id = result.get("post_id") or result.get("id")

        if not post_id:
            raise Exception(f"Unexpected Facebook response: {result}")

        return {
            "post_id": post_id
        }