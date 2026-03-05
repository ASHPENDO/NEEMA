# app/api/v1/catalog.py
from __future__ import annotations

import asyncio
import json
import random
import re
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.permissions import require_permissions
from app.api.deps.tenant import get_current_membership
from app.db.session import get_db
from app.models.catalog_item import CatalogItem
from app.schemas.catalog import (
    CatalogItemCreate,
    CatalogItemResponse,
    CatalogItemUpdate,
    CatalogScrapeRequest,
    CatalogScrapeResponse,
)

from .catalog_upload import router as catalog_upload_router

router = APIRouter(prefix="/catalog/items", tags=["catalog"])


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_PRICE_RE = re.compile(r"(KSh|KES|Sh)\s*([0-9][0-9,\.]*)", flags=re.IGNORECASE)

# A few realistic UA strings. Keep small + stable.
_UA_POOL = [
    # Chrome Win10
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # Chrome Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # Safari Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    # Firefox Win10
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]


def _coerce_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    if isinstance(value, str):
        s = value.strip()
        s = re.sub(r"[^\d.]+", "", s)  # "KSh 24,995" -> "24995"
        if not s:
            return None
        try:
            return Decimal(s)
        except (InvalidOperation, ValueError):
            return None
    return None


def _site_root(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def _browser_like_headers(target_url: str) -> Dict[str, str]:
    root = _site_root(target_url)
    ua = random.choice(_UA_POOL)

    # A conservative, browser-ish set. Avoid adding too many fingerprinty headers.
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,sw;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "Referer": root + "/",
    }


def _extract_jsonld_blocks(html: str) -> List[Any]:
    blocks: List[Any] = []
    pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.IGNORECASE | re.DOTALL,
    )
    for m in pattern.finditer(html):
        raw = (m.group(1) or "").strip()
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except Exception:
            try:
                blocks.append(json.loads(raw.strip().strip(";")))
            except Exception:
                continue
    return blocks


def _iter_products_from_jsonld(data: Any) -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []

    def walk(node: Any) -> None:
        if node is None:
            return
        if isinstance(node, list):
            for x in node:
                walk(x)
            return
        if not isinstance(node, dict):
            return

        if "@graph" in node and isinstance(node["@graph"], list):
            for el in node["@graph"]:
                walk(el)

        if str(node.get("@type", "")).lower() == "itemlist" and isinstance(node.get("itemListElement"), list):
            for el in node["itemListElement"]:
                if isinstance(el, dict) and isinstance(el.get("item"), dict):
                    walk(el["item"])
                else:
                    walk(el)
            return

        t = node.get("@type")
        if isinstance(t, list):
            is_product = any(str(x).lower() == "product" for x in t)
        else:
            is_product = str(t).lower() == "product"

        if is_product:
            products.append(node)

    walk(data)
    return products


def _extract_product_fields(
    prod: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[Decimal], Optional[str]]:
    title = prod.get("name") or prod.get("title")
    description = prod.get("description")
    sku = prod.get("sku") or prod.get("mpn")

    price_amount: Optional[Decimal] = None
    price_currency: Optional[str] = None

    offers = prod.get("offers")
    offer_obj: Optional[Dict[str, Any]] = None
    if isinstance(offers, dict):
        offer_obj = offers
    elif isinstance(offers, list) and offers and isinstance(offers[0], dict):
        offer_obj = offers[0]

    if offer_obj:
        price_amount = _coerce_decimal(offer_obj.get("price"))
        price_currency = offer_obj.get("priceCurrency")

        ps = offer_obj.get("priceSpecification")
        if price_amount is None and isinstance(ps, dict):
            price_amount = _coerce_decimal(ps.get("price"))
            price_currency = price_currency or ps.get("priceCurrency")

    if price_amount is None:
        price_amount = _coerce_decimal(prod.get("price"))

    if price_currency is None:
        pc = prod.get("priceCurrency") or prod.get("currency")
        if isinstance(pc, str) and pc.strip():
            price_currency = pc.strip()

    if isinstance(title, str):
        title = title.strip()
    else:
        title = None

    if isinstance(description, str):
        description = description.strip()
    else:
        description = None

    if isinstance(sku, str):
        sku = sku.strip()
    else:
        sku = None

    if isinstance(price_currency, str):
        price_currency = price_currency.strip()

    return title, description, sku, price_amount, price_currency


def _extract_og_fallback(html: str) -> Tuple[Optional[str], Optional[str]]:
    def meta(property_name: str) -> Optional[str]:
        m = re.search(
            rf'<meta[^>]+property=["\']{re.escape(property_name)}["\'][^>]+content=["\'](.*?)["\']',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not m:
            return None
        val = re.sub(r"\s+", " ", (m.group(1) or "")).strip()
        return val or None

    def meta_name(name: str) -> Optional[str]:
        m = re.search(
            rf'<meta[^>]+name=["\']{re.escape(name)}["\'][^>]+content=["\'](.*?)["\']',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not m:
            return None
        val = re.sub(r"\s+", " ", (m.group(1) or "")).strip()
        return val or None

    ogt = meta("og:title")
    ogd = meta("og:description") or meta_name("description")
    return ogt, ogd


def _strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _extract_product_links(base_url: str, html: str, limit: int) -> List[str]:
    """
    Discover product links on collection/category pages.
    Supports:
      - Shopify: /products/<handle>
      - Woo: /product/<slug>
      - Homelink-style: /catalogue/<slug>  (exclude /catalogue/category/)
    """
    parsed = urlparse(base_url)
    base_host = parsed.netloc

    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
    candidates: List[str] = []

    for href in hrefs:
        if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        abs_url = urljoin(base_url, href)
        p = urlparse(abs_url)
        if p.scheme not in ("http", "https"):
            continue
        if p.netloc != base_host:
            continue

        path = (p.path or "").lower()
        q = (p.query or "").lower()

        is_shopify = "/products/" in path
        is_woo = "/product/" in path or "product=" in q
        is_homelink = "/catalogue/" in path and "/catalogue/category/" not in path

        if is_shopify or is_woo or is_homelink:
            candidates.append(abs_url)

    seen: Set[str] = set()
    out: List[str] = []
    for u in candidates:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= limit:
            break
    return out


def _is_blocked_status(code: int) -> bool:
    return code in (401, 403, 429)


def _extract_meta_refresh_url(html: str) -> Optional[str]:
    # <meta http-equiv="refresh" content="0; url=/somewhere">
    m = re.search(
        r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\']\s*\d+\s*;\s*url=([^"\']+)["\']',
        html,
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    return (m.group(1) or "").strip() or None


def _extract_js_redirect_url(html: str) -> Optional[str]:
    # very light heuristics
    patterns = [
        r"window\.location\.href\s*=\s*['\"]([^'\"]+)['\"]",
        r"window\.location\s*=\s*['\"]([^'\"]+)['\"]",
        r"location\.href\s*=\s*['\"]([^'\"]+)['\"]",
    ]
    for pat in patterns:
        m = re.search(pat, html, flags=re.IGNORECASE)
        if m:
            u = (m.group(1) or "").strip()
            if u:
                return u
    return None


async def _fetch_soft(client: httpx.AsyncClient, url: str, *, max_retries: int = 3) -> Tuple[int, str]:
    """
    Option B: "softer" fetching.
    - Rotate browser-like headers
    - Add small retry/backoff on 403/429
    - Handle simple meta refresh / JS redirect once
    """
    last_status = 0
    last_text = ""

    for attempt in range(max_retries):
        headers = _browser_like_headers(url)

        try:
            r = await client.get(url, headers=headers)
        except httpx.RequestError as e:
            # network/DNS errors: fail fast with a 502 upstream
            raise HTTPException(status_code=502, detail=f"Failed to fetch URL (network/DNS error): {str(e)}")

        last_status = r.status_code
        last_text = r.text or ""

        # Handle soft redirects commonly used by some sites (not JS challenges)
        if r.status_code == 200 and last_text:
            meta_u = _extract_meta_refresh_url(last_text)
            js_u = _extract_js_redirect_url(last_text)
            next_u = meta_u or js_u
            if next_u:
                next_abs = urljoin(url, next_u)
                # follow once, with fresh headers
                r2 = await client.get(next_abs, headers=_browser_like_headers(next_abs))
                return r2.status_code, (r2.text or "")

        if last_status in (429, 403):
            # backoff with jitter; try again with a different UA / headers
            await asyncio.sleep((0.6 * (attempt + 1)) + random.random() * 0.6)
            continue

        return last_status, last_text

    return last_status, last_text


def _products_from_html_jsonld(html: str) -> List[Dict[str, Any]]:
    blocks = _extract_jsonld_blocks(html)
    out: List[Dict[str, Any]] = []
    for b in blocks:
        out.extend(_iter_products_from_jsonld(b))
    return out


def _parse_price_from_text(text: str) -> Optional[Decimal]:
    m = _PRICE_RE.search(text)
    if not m:
        return None
    return _coerce_decimal(m.group(2))


def _parse_homelink_list_page(html: str, base_url: str, limit: int) -> List[Dict[str, Any]]:
    anchors = re.findall(
        r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )

    items: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    for href, inner in anchors:
        if len(items) >= limit:
            break

        abs_url = urljoin(base_url, href)
        p = urlparse(abs_url)
        path = (p.path or "").lower()

        if "/catalogue/" not in path or "/catalogue/category/" in path:
            continue

        text = _strip_tags(inner)
        if not text:
            continue

        if "kes" not in text.lower() and "ksh" not in text.lower() and "sh" not in text.lower():
            continue

        price_amount = _parse_price_from_text(text)
        if not price_amount or price_amount <= 0:
            continue

        title = text
        title = re.sub(r"\bOut of stock\b", "", title, flags=re.IGNORECASE)
        title = _PRICE_RE.sub("", title)
        title = re.sub(r"\bView product\b", "", title, flags=re.IGNORECASE)
        title = re.sub(r"\+\s*Compare\b", "", title, flags=re.IGNORECASE)
        title = re.sub(r"\s+", " ", title).strip()

        if not title or len(title) > 255:
            continue

        key = abs_url
        if key in seen:
            continue
        seen.add(key)

        items.append(
            {
                "__source_link": abs_url,
                "name": title,
                "description": None,
                "sku": None,
                "price_amount": price_amount,
                "price_currency": "KES",
            }
        )

    return items


def _parse_product_page_fallback(html: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[Decimal]]:
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, flags=re.IGNORECASE | re.DOTALL)
    title = _strip_tags(h1.group(1)) if h1 else None

    og_title, og_desc = _extract_og_fallback(html)
    if not title:
        title = og_title

    sku = None
    msku = re.search(r"\bSKU\b[:\s]*([A-Za-z0-9\-_]+)", html, flags=re.IGNORECASE)
    if msku:
        sku = msku.group(1).strip()

    price_amount = None
    mprice = _PRICE_RE.search(html)
    if mprice:
        price_amount = _coerce_decimal(mprice.group(2))

    desc = og_desc
    if not desc:
        ps = re.findall(r"<p[^>]*>(.*?)</p>", html, flags=re.IGNORECASE | re.DOTALL)
        for p in ps[:10]:
            t = _strip_tags(p)
            if len(t) >= 60:
                desc = t
                break

    return title, desc, sku, price_amount


async def _try_woocommerce_store_api(client: httpx.AsyncClient, root: str, max_items: int) -> List[Dict[str, Any]]:
    url = f"{root}/wp-json/wc/store/v1/products?per_page={min(max_items, 100)}"
    r = await client.get(url, headers={"Accept": "application/json"})
    if r.status_code != 200:
        return []
    try:
        data = r.json()
    except Exception:
        return []
    if not isinstance(data, list):
        return []

    out: List[Dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue

        prices = item.get("prices") if isinstance(item.get("prices"), dict) else {}
        currency = prices.get("currency_code") if isinstance(prices.get("currency_code"), str) else None

        price_raw = prices.get("price")
        if price_raw is None:
            price_raw = item.get("price")

        price_amount = _coerce_decimal(price_raw)
        if price_amount is None or price_amount <= 0:
            continue

        out.append(
            {
                "name": name.strip(),
                "description": item.get("short_description") or item.get("description"),
                "sku": item.get("sku"),
                "price_amount": price_amount,
                "price_currency": (currency or "KES"),
            }
        )
        if len(out) >= max_items:
            break
    return out


async def _try_shopify_product_json(client: httpx.AsyncClient, product_url: str) -> Optional[Dict[str, Any]]:
    p = urlparse(product_url)
    if "/products/" not in (p.path or ""):
        return None

    js_url = product_url
    if not js_url.endswith(".js"):
        js_url = js_url.rstrip("/") + ".js"

    r = await client.get(js_url, headers={"Accept": "application/json"})
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:
        return None
    if not isinstance(data, dict):
        return None

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        return None

    variants = data.get("variants") if isinstance(data.get("variants"), list) else []
    price_amount = None
    for v in variants:
        if not isinstance(v, dict):
            continue
        price_amount = _coerce_decimal(v.get("price"))
        if price_amount:
            break

    if not price_amount or price_amount <= 0:
        return None

    sku = None
    for v in variants:
        if isinstance(v, dict) and isinstance(v.get("sku"), str) and v.get("sku").strip():
            sku = v.get("sku").strip()
            break

    return {
        "name": title.strip(),
        "description": data.get("description"),
        "sku": sku,
        "price_amount": price_amount,
        "price_currency": "KES",
    }


def _make_item(
    membership: Any,
    title: str,
    description: Optional[str],
    sku: Optional[str],
    price_amount: Decimal,
    price_currency: str,
) -> CatalogItem:
    return CatalogItem(
        id=uuid.uuid4(),
        tenant_id=membership.tenant_id,
        created_by_user_id=getattr(membership, "user_id", None),
        title=title,
        sku=sku,
        description=description,
        price_amount=price_amount,
        price_currency=price_currency,
        status="active",
    )


def _ingest_products_dicts(
    *,
    db: AsyncSession,
    membership: Any,
    product_dicts: List[Dict[str, Any]],
    max_items: int,
    default_currency: str,
) -> Tuple[List[CatalogItem], int]:
    created: List[CatalogItem] = []
    skipped = 0

    for prod in product_dicts:
        if len(created) >= max_items:
            break
        title, description, sku, price_amount, price_currency = _extract_product_fields(prod)
        if not price_currency:
            price_currency = default_currency
        if not title or not price_amount or price_amount <= 0:
            skipped += 1
            continue
        item = _make_item(
            membership=membership,
            title=title,
            description=description,
            sku=sku,
            price_amount=price_amount,
            price_currency=price_currency,
        )
        db.add(item)
        created.append(item)

    return created, skipped


# ------------------------------------------------------------------
# CRUD
# ------------------------------------------------------------------

@router.get("", response_model=List[CatalogItemResponse])
async def list_catalog_items(
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:read")),
):
    stmt = (
        select(CatalogItem)
        .where(CatalogItem.tenant_id == membership.tenant_id)
        .order_by(CatalogItem.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=CatalogItemResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog_item(
    payload: CatalogItemCreate,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:create")),
):
    item = _make_item(
        membership=membership,
        title=payload.title,
        description=payload.description,
        sku=payload.sku,
        price_amount=payload.price_amount,
        price_currency=payload.price_currency,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=CatalogItemResponse)
async def get_catalog_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:read")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=CatalogItemResponse)
async def update_catalog_item(
    item_id: uuid.UUID,
    payload: CatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:update")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:delete")),
):
    stmt = select(CatalogItem).where(
        CatalogItem.id == item_id,
        CatalogItem.tenant_id == membership.tenant_id,
    )
    result = await db.execute(stmt)
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()
    return None


# ------------------------------------------------------------------
# Scrape ingestion (server fetch) - Option B ("softer" fetching)
# ------------------------------------------------------------------

@router.post("/scrape", response_model=CatalogScrapeResponse, status_code=status.HTTP_201_CREATED)
async def scrape_catalog_items(
    payload: CatalogScrapeRequest,
    db: AsyncSession = Depends(get_db),
    membership=Depends(get_current_membership),
    _=Depends(require_permissions("catalog:create")),
):
    url = str(payload.url)
    root = _site_root(url)

    created: List[CatalogItem] = []
    skipped = 0
    discovered_links = 0
    fetched_pages = 0
    mode_used = "unknown"

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(25.0, connect=10.0),
        follow_redirects=True,
        http2=True,
    ) as client:
        # 0) Try WooCommerce Store API first (if enabled)
        if payload.try_woocommerce_store_api:
            try:
                api_products = await _try_woocommerce_store_api(client, root, max_items=payload.max_items)
                if api_products:
                    for p in api_products[: payload.max_items]:
                        title = (p.get("name") or "").strip()
                        price_amount = _coerce_decimal(p.get("price_amount"))
                        price_currency = p.get("price_currency") or payload.default_currency
                        if not title or not price_amount or price_amount <= 0:
                            skipped += 1
                            continue
                        item = _make_item(
                            membership=membership,
                            title=title,
                            description=p.get("description"),
                            sku=p.get("sku"),
                            price_amount=price_amount,
                            price_currency=str(price_currency),
                        )
                        db.add(item)
                        created.append(item)
                    mode_used = "woocommerce_api"
            except Exception:
                pass

        # 1) Fetch the provided URL with "soft" improvements
        if not created:
            status_code, html = await _fetch_soft(client, url, max_retries=3)

            if _is_blocked_status(status_code):
                return CatalogScrapeResponse(
                    source_url=url,
                    created=[],
                    skipped=0,
                    mode_used="blocked",
                    discovered_product_links=0,
                    fetched_product_pages=0,
                    blocked=True,
                    blocked_status_code=status_code,
                    blocked_hint=(
                        "Site returned a forbidden/rate-limit response (likely anti-bot). "
                        "Try a different URL (a direct product URL), enable crawling, or use bulk upload instead."
                    ),
                )

            # 2) JSON-LD Product/Offer ingestion
            product_dicts = _products_from_html_jsonld(html)
            if product_dicts:
                new_created, new_skipped = _ingest_products_dicts(
                    db=db,
                    membership=membership,
                    product_dicts=product_dicts,
                    max_items=payload.max_items,
                    default_currency=payload.default_currency,
                )
                created.extend(new_created)
                skipped += new_skipped
                if created:
                    mode_used = "jsonld"

            # 3) Homelink-style category/list parsing
            if not created:
                homelink_items = _parse_homelink_list_page(html, base_url=url, limit=min(payload.max_items, 200))
                if homelink_items:
                    for p in homelink_items:
                        if len(created) >= payload.max_items:
                            break
                        title = (p.get("name") or "").strip()
                        price_amount = _coerce_decimal(p.get("price_amount"))
                        if not title or not price_amount or price_amount <= 0:
                            skipped += 1
                            continue
                        item = _make_item(
                            membership=membership,
                            title=title,
                            description=None,
                            sku=None,
                            price_amount=price_amount,
                            price_currency=payload.default_currency,
                        )
                        db.add(item)
                        created.append(item)
                    if created:
                        mode_used = "homelink_list"

            # 4) Optional crawl of product pages discovered from the URL page
            if payload.crawl_product_pages and len(created) < payload.max_items:
                links = _extract_product_links(url, html, limit=payload.max_product_pages)
                discovered_links = len(links)

                for link in links:
                    if len(created) >= payload.max_items:
                        break

                    # fetch each product link with soft headers (no heavy retries here)
                    try:
                        r = await client.get(link, headers=_browser_like_headers(link))
                    except httpx.RequestError:
                        continue

                    if _is_blocked_status(r.status_code) or r.status_code != 200:
                        continue

                    fetched_pages += 1
                    p_html = r.text or ""

                    p_products = _products_from_html_jsonld(p_html)
                    ingested_this_page = False

                    if p_products:
                        new_created, new_skipped = _ingest_products_dicts(
                            db=db,
                            membership=membership,
                            product_dicts=p_products,
                            max_items=(payload.max_items - len(created)),
                            default_currency=payload.default_currency,
                        )
                        created.extend(new_created)
                        skipped += new_skipped
                        ingested_this_page = bool(new_created)

                    if (not ingested_this_page) and payload.try_shopify_product_json:
                        shopify_p = await _try_shopify_product_json(client, link)
                        if shopify_p:
                            title = (shopify_p.get("name") or "").strip()
                            price_amount = _coerce_decimal(shopify_p.get("price_amount"))
                            if title and price_amount and price_amount > 0:
                                item = _make_item(
                                    membership=membership,
                                    title=title,
                                    description=shopify_p.get("description"),
                                    sku=shopify_p.get("sku"),
                                    price_amount=price_amount,
                                    price_currency=payload.default_currency,
                                )
                                db.add(item)
                                created.append(item)
                                ingested_this_page = True

                    if (not ingested_this_page) and payload.allow_fallback:
                        t, d, sku, pa = _parse_product_page_fallback(p_html)
                        if t and pa and pa > 0:
                            item = _make_item(
                                membership=membership,
                                title=t.strip(),
                                description=d,
                                sku=sku,
                                price_amount=pa,
                                price_currency=payload.default_currency,
                            )
                            db.add(item)
                            created.append(item)
                            ingested_this_page = True

                    if ingested_this_page and mode_used == "unknown":
                        mode_used = "crawl_product_pages"

            # 5) Last-resort fallback from OG + provided fallback price
            if not created and payload.allow_fallback:
                og_title, og_desc = _extract_og_fallback(html)
                if og_title and payload.fallback_price_amount and payload.fallback_price_amount > 0:
                    item = _make_item(
                        membership=membership,
                        title=og_title.strip(),
                        description=og_desc,
                        sku=None,
                        price_amount=payload.fallback_price_amount,
                        price_currency=(payload.fallback_price_currency or payload.default_currency),
                    )
                    db.add(item)
                    created.append(item)
                    mode_used = "og_fallback"

    if not created:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No valid products found to ingest (missing title/price). "
                "Try a direct product URL, enable crawling, or use bulk upload."
            ),
        )

    await db.commit()
    for item in created:
        await db.refresh(item)

    created_models = [CatalogItemResponse.model_validate(i, from_attributes=True) for i in created]

    return CatalogScrapeResponse(
        source_url=url,
        created=created_models,
        skipped=skipped,
        mode_used=mode_used,
        discovered_product_links=discovered_links,
        fetched_product_pages=fetched_pages,
        blocked=False,
        blocked_status_code=None,
        blocked_hint=None,
    )


# ------------------------------------------------------------------
# Bulk Upload Router Mount
# ------------------------------------------------------------------

router.include_router(
    catalog_upload_router,
    tags=["catalog"],
)