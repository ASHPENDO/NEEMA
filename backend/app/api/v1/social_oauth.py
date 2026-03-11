from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.core.config import settings

router = APIRouter(prefix="/social/meta", tags=["social-oauth-meta"])

META_GRAPH_VERSION = "v25.0"

# Force the standard full-page Facebook OAuth endpoint.
META_OAUTH_URL = f"https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth"
META_TOKEN_URL = f"https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"

# Replace with Redis/DB in production
OAUTH_STATE_STORE: dict[str, dict] = {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_meta_scopes() -> str:
    return ",".join([
        "pages_show_list",
        "pages_read_engagement",
    ])


@router.get("/connect")
async def connect_meta(
    tenant_id: str = Query(...),
    user_id: str = Query(...),
):
    state = secrets.token_urlsafe(32)

    OAUTH_STATE_STORE[state] = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "created_at": utcnow().isoformat(),
    }

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "state": state,
        "scope": build_meta_scopes(),
        "response_type": "code",
        "display": "page",
    }

    auth_url = f"{META_OAUTH_URL}?{urlencode(params)}"

    print("META CONNECT HIT")
    print("META_APP_ID =", settings.META_APP_ID)
    print("META_REDIRECT_URI =", settings.META_REDIRECT_URI)
    print("META_SCOPES =", build_meta_scopes())
    print("STATE =", state)
    print("AUTH_URL =", auth_url)

    return RedirectResponse(url=auth_url, status_code=302)


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
    print("code present =", bool(code))
    print("state =", state)
    print("error =", error)
    print("error_reason =", error_reason)
    print("error_description =", error_description)
    print("error_code =", error_code)
    print("error_message =", error_message)

    if error or error_code or error_message:
        raise HTTPException(
            status_code=400,
            detail={
                "error": error,
                "error_reason": error_reason,
                "error_description": error_description,
                "error_code": error_code,
                "error_message": error_message,
            },
        )

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    state_data = OAUTH_STATE_STORE.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1) Exchange code for short-lived token
        token_resp = await client.get(
            META_TOKEN_URL,
            params={
                "client_id": settings.META_APP_ID,
                "redirect_uri": settings.META_REDIRECT_URI,
                "client_secret": settings.META_APP_SECRET,
                "code": code,
            },
        )
        token_resp.raise_for_status()
        short_token_data = token_resp.json()

        if "access_token" not in short_token_data:
            raise HTTPException(status_code=400, detail="Meta did not return short-lived access token")

        print("SHORT TOKEN EXCHANGE SUCCESS")

        short_lived_token = short_token_data["access_token"]

        # 2) Exchange for long-lived token
        long_resp = await client.get(
            META_TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            },
        )
        long_resp.raise_for_status()
        long_token_data = long_resp.json()

        if "access_token" not in long_token_data:
            raise HTTPException(status_code=400, detail="Meta did not return long-lived access token")

        print("LONG TOKEN EXCHANGE SUCCESS")

        long_lived_token = long_token_data["access_token"]
        expires_in = long_token_data.get("expires_in")
        token_expires_at = utcnow() + timedelta(seconds=expires_in) if expires_in else None

        # 3) Get user profile
        me_resp = await client.get(
            f"{META_GRAPH_BASE}/me",
            params={
                "fields": "id,name",
                "access_token": long_lived_token,
            },
        )
        me_resp.raise_for_status()
        me_data = me_resp.json()
        print("ME RESPONSE =", me_data)

        # 4) Discover pages
        pages_resp = await client.get(
            f"{META_GRAPH_BASE}/me/accounts",
            params={
                "fields": "id,name,access_token,category,tasks",
                "access_token": long_lived_token,
            },
        )
        pages_resp.raise_for_status()
        pages_json = pages_resp.json()
        print("PAGES FOUND =", len(pages_json.get("data", [])))

        pages_data = pages_json.get("data", [])

        discovered_pages: list[dict] = []
        discovered_instagrams: list[dict] = []

        for page in pages_data:
            page_id = page["id"]

            page_detail_resp = await client.get(
                f"{META_GRAPH_BASE}/{page_id}",
                params={
                    "fields": "id,name,instagram_business_account{id,username,name,profile_picture_url}",
                    "access_token": long_lived_token,
                },
            )
            page_detail_resp.raise_for_status()
            page_detail = page_detail_resp.json()
            print(f"PAGE DETAIL FETCHED FOR PAGE {page_id}")

            page_record = {
                "page_id": page["id"],
                "page_name": page["name"],
                "category": page.get("category"),
                "tasks": page.get("tasks", []),
                "has_page_access_token": bool(page.get("access_token")),
            }
            discovered_pages.append(page_record)

            ig = page_detail.get("instagram_business_account")
            if ig:
                discovered_instagrams.append({
                    "page_id": page["id"],
                    "page_name": page["name"],
                    "instagram_id": ig["id"],
                    "instagram_username": ig.get("username"),
                    "instagram_name": ig.get("name"),
                    "profile_picture_url": ig.get("profile_picture_url"),
                })

    return {
        "status": "connected",
        "tenant_id": state_data["tenant_id"],
        "meta_user": me_data,
        "token_expires_at": token_expires_at.isoformat() if token_expires_at else None,
        "pages": discovered_pages,
        "instagram_accounts": discovered_instagrams,
    }