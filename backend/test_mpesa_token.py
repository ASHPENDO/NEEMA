import httpx
import base64
import asyncio
from app.core.config import settings

async def test_token():
    key = settings.MPESA_CONSUMER_KEY.strip()
    secret = settings.MPESA_CONSUMER_SECRET.strip()

    print("KEY:", key)
    print("SECRET:", secret)
    print("KEY LEN:", len(key))

    auth = base64.b64encode(f"{key}:{secret}".encode()).decode()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            headers={
                "Authorization": f"Basic {auth}"
            }
        )

        print("STATUS:", response.status_code)
        print("BODY:", response.text)

asyncio.run(test_token())