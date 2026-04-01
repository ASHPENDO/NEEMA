# app/api/v1/social_oauth.py

from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlencode

from app.db.session import get_db
from app.models.social_account import SocialAccount
from app.models.meta_catalog import MetaCatalog

import httpx
from datetime import datetime, timezone, timedelta

from app.core.config import settings

import json
import uuid
from app.core.redis import redis_client

META_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
META_GRAPH_BASE = "https://graph.facebook.com/v19.0"

router = APIRouter(prefix="/social/meta", tags=["social-oauth"])


@router.get("/connect")
async def meta_connect(
    tenant_id: str,
    user_id: str,
    force_reauth: bool = False,
):
    state = str(uuid.uuid4())

    state_payload = {
        "tenant_id": tenant_id,
        "user_id": user_id,
    }

    await redis_client.set(
        f"oauth_state:{state}",
        json.dumps(state_payload),
        ex=300
    )

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "state": state,
        "scope": "pages_manage_posts,pages_read_engagement,pages_show_list",
        "response_type": "code",
    }

    if force_reauth:
        params["auth_type"] = "rerequest"

    auth_url = f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}"

    return {"auth_url": auth_url}


async def meta_get(client, url, params, label="META"):
    response = await client.get(url, params=params)
    data = response.json()

    if "error" in data:
        print(f"{label} ERROR:", data)
        raise HTTPException(status_code=400, detail=data)

    return data


@router.get("/callback")
async def meta_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_reason: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    error_code: str | None = Query(default=None),
    error_message: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    print("META CALLBACK HIT")

    if error or error_code or error_message:
        raise HTTPException(status_code=400, detail="OAuth error")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    raw_state = await redis_client.get(f"oauth_state:{state}")

    if not raw_state:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    state_data = json.loads(raw_state)

    await redis_client.delete(f"oauth_state:{state}")

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:

        short_token_data = await meta_get(
            client,
            META_TOKEN_URL,
            {
                "client_id": settings.META_APP_ID,
                "redirect_uri": settings.META_REDIRECT_URI,
                "client_secret": settings.META_APP_SECRET,
                "code": code,
            },
            label="SHORT TOKEN",
        )

        short_lived_token = short_token_data.get("access_token")
        if not short_lived_token:
            raise HTTPException(status_code=400, detail="No short-lived token")

        long_token_data = await meta_get(
            client,
            META_TOKEN_URL,
            {
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            },
            label="LONG TOKEN",
        )

        long_lived_token = long_token_data.get("access_token")
        if not long_lived_token:
            raise HTTPException(status_code=400, detail="No long-lived token")

        expires_in = long_token_data.get("expires_in")

        token_expires_at = (
            (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).replace(tzinfo=None)
            if expires_in else None
        )

        pages_json = await meta_get(
            client,
            f"{META_GRAPH_BASE}/me/accounts",
            {
                "fields": "id,name,access_token",
                "access_token": long_lived_token,
            },
            label="PAGES",
        )

        pages_data = pages_json.get("data", [])
        print("PAGES FOUND =", len(pages_data))

    try:
        for page in pages_data:

            existing_query = await db.execute(
                select(SocialAccount).where(
                    SocialAccount.tenant_id == state_data["tenant_id"],
                    SocialAccount.page_id == page.get("id"),
                    SocialAccount.platform == "facebook",
                )
            )

            existing_account = existing_query.scalars().first()

            if existing_account:
                existing_account.page_access_token = page.get("access_token")
                existing_account.page_name = page.get("name")
                existing_account.token_expires_at = token_expires_at

                existing_account.status = "active"
                existing_account.requires_reauth = False
                existing_account.last_error = None
                existing_account.last_checked_at = datetime.utcnow()

            else:
                account = SocialAccount(
                    tenant_id=state_data["tenant_id"],
                    meta_user_id="unknown",
                    token_expires_at=token_expires_at,
                    page_id=page.get("id"),
                    page_name=page.get("name"),
                    page_access_token=page.get("access_token"),
                    status="active",
                    requires_reauth=False,
                    last_checked_at=datetime.utcnow(),
                )
                db.add(account)

        await db.commit()

    except Exception as e:
        await db.rollback()
        print("DB SAVE ERROR =", str(e))
        raise

    return {
        "status": "connected",
        "tenant_id": state_data["tenant_id"],
        "pages_saved": len(pages_data),
    }