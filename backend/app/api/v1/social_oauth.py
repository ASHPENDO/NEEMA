from fastapi import APIRouter, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.social_account import SocialAccount

import httpx
from datetime import datetime, timezone, timedelta

from app.core.config import settings

# 🔐 In-memory OAuth state store (simple for now)
OAUTH_STATE_STORE = {}

# Meta endpoints
META_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
META_GRAPH_BASE = "https://graph.facebook.com/v19.0"

router = APIRouter(prefix="/social/meta", tags=["social-oauth"])


# ✅ STEP 1 — CONNECT (ENTRY POINT)
@router.get("/connect")
def meta_connect(tenant_id: str, user_id: str):
    state = f"{tenant_id}:{user_id}"

    OAUTH_STATE_STORE[state] = {
        "tenant_id": tenant_id,
        "user_id": user_id,
    }

    auth_url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={settings.META_APP_ID}"
        f"&redirect_uri={settings.META_REDIRECT_URI}"
        f"&state={state}"
        f"&scope=pages_show_list,business_management"
    )

    return {"auth_url": auth_url}


# ✅ HELPER
async def meta_get(client, url, params, label="META"):
    response = await client.get(url, params=params)
    data = response.json()

    if "error" in data:
        print(f"{label} ERROR:", data)
        raise HTTPException(status_code=400, detail=data)

    return data


# ✅ STEP 2 — CALLBACK
@router.get("/callback")
async def meta_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_reason: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    error_code: str | None = Query(default=None),
    error_message: str | None = Query(default=None),
):
    print("META CALLBACK HIT")

    if error or error_code or error_message:
        raise HTTPException(status_code=400, detail="OAuth error")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    state_data = OAUTH_STATE_STORE.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:

        # 1. Short-lived token
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

        # 2. Long-lived token
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
            datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            if expires_in else None
        )

        # 3. Fetch pages
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

    # ✅ STORE IN DB
    db_gen = get_db()
    db: Session = next(db_gen)

    try:
        for page in pages_data:
            account = SocialAccount(
                tenant_id=state_data["tenant_id"],
                meta_user_id="unknown",
                access_token=long_lived_token,
                token_expires_at=token_expires_at,
                page_id=page.get("id"),
                page_name=page.get("name"),
                page_access_token=page.get("access_token"),
            )
            db.add(account)

        db.commit()

    except Exception as e:
        db.rollback()
        print("DB SAVE ERROR =", str(e))
        raise

    finally:
        db.close()

    return {
        "status": "connected",
        "tenant_id": state_data["tenant_id"],
        "pages_saved": len(pages_data),
    }