# app/services/posting/platforms/facebook.py

import httpx


class FacebookAdapter:
    async def post(self, payload, social_account):
        """
        Posts image + caption to a Facebook Page
        """

        page_id = social_account.page_id
        access_token = social_account.access_token

        url = f"https://graph.facebook.com/v19.0/{page_id}/photos"

        data = {
            "url": payload.image_url,
            "caption": payload.caption,
            "access_token": access_token,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)

        if response.status_code != 200:
            raise Exception(f"Facebook API error: {response.text}")

        result = response.json()

        return {
            "post_id": result.get("post_id") or result.get("id")
        }