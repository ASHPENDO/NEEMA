from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings


class MetaOAuthError(Exception):
    def __init__(self, message: str, *, payload: dict[str, Any] | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.payload = payload or {}
        self.status_code = status_code


def build_meta_authorize_url(state: str, redirect_uri: str | None = None) -> str:
    if not settings.META_APP_ID:
        raise MetaOAuthError("META_APP_ID is not configured.")

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": redirect_uri or settings.META_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "scope": ",".join(settings.META_SCOPE_LIST),
    }
    return f"{settings.META_OAUTH_DIALOG_URL}?{urlencode(params)}"


async def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)

    try:
        data = response.json()
    except Exception:
        data = {"raw_text": response.text}

    if response.status_code >= 400:
        raise MetaOAuthError(
            "Meta API request failed.",
            payload=data if isinstance(data, dict) else {"data": data},
            status_code=response.status_code,
        )

    if not isinstance(data, dict):
        raise MetaOAuthError("Meta API returned a non-object JSON response.", payload={"data": data})

    return data


async def exchange_code_for_user_token(code: str, redirect_uri: str | None = None) -> dict[str, Any]:
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise MetaOAuthError("META_APP_ID and META_APP_SECRET must be configured.")

    url = f"{settings.META_GRAPH_BASE_URL}/oauth/access_token"
    params = {
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "redirect_uri": redirect_uri or settings.META_REDIRECT_URI,
        "code": code,
    }
    return await _get_json(url, params)


async def exchange_for_long_lived_user_token(short_lived_user_token: str) -> dict[str, Any]:
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise MetaOAuthError("META_APP_ID and META_APP_SECRET must be configured.")

    url = f"{settings.META_GRAPH_BASE_URL}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "fb_exchange_token": short_lived_user_token,
    }
    return await _get_json(url, params)


async def fetch_user_profile(user_access_token: str) -> dict[str, Any]:
    url = f"{settings.META_GRAPH_BASE_URL}/me"
    params = {
        "fields": "id,name",
        "access_token": user_access_token,
    }
    return await _get_json(url, params)


async def fetch_manageable_pages(user_access_token: str) -> dict[str, Any]:
    url = f"{settings.META_GRAPH_BASE_URL}/me/accounts"
    params = {
        "fields": "id,name,access_token,category,category_list,tasks,instagram_business_account{id,username,name}",
        "access_token": user_access_token,
    }
    return await _get_json(url, params)