# app/services/posting/platforms/facebook.py

import httpx
from fastapi import HTTPException


class FacebookPoster:

    async def post(self, payload, social_account):
        page_access_token = social_account.page_access_token
        page_id = payload.page_id

        graph_url = f"https://graph.facebook.com/v19.0/{page_id}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if payload.image_url:
                    response = await client.post(
                        f"{graph_url}/photos",
                        data={
                            "url": payload.image_url,
                            "caption": payload.caption,
                            "access_token": page_access_token,
                        },
                    )
                else:
                    response = await client.post(
                        f"{graph_url}/feed",
                        data={
                            "message": payload.caption,
                            "access_token": page_access_token,
                        },
                    )

                data = response.json()

            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Facebook request failed: {str(e)}",
                )

        if response.status_code != 200 or "error" in data:
            error = data.get("error", {})
            raise HTTPException(
                status_code=400,
                detail={
                    "platform": "facebook",
                    "message": error.get("message"),
                    "code": error.get("code"),
                },
            )

        return {
            "platform": "facebook",
            "post_id": data.get("id"),
        }