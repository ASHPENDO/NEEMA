from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio

from app.core.config import settings
import app.models  # noqa: F401

# ✅ DB INIT
from app.db.base import Base
from app.db.session import engine

# -----------------------------
# Routers
# -----------------------------
from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.tenant_invitations import router as tenant_invitations_router
from app.api.v1.platform_invitations import router as platform_invitations_router
from app.api.v1.sales import router as sales_router
from app.api.v1.platform_sales import router as platform_sales_router
from app.api.v1.catalog import router as catalog_router, catalog_alias_router
from app.api.v1.social_oauth import router as social_oauth_router
from app.api.v1.facebook_catalog import router as facebook_catalog_router

# Posting
from app.api.v1.endpoints.posting import router as posting_router

# Campaign creation/update
from app.api.v1.campaign import router as campaign_router

# Campaign visibility
from app.api.v1.endpoints.campaigns import router as campaigns_router

# Templates
from app.api.v1.templates import router as templates_router

# Scheduler
from app.services.scheduler import campaign_scheduler

# AI
from app.api.v1.ai import router as ai_router

# Social Accounts
from app.api.v1.social_accounts import router as social_accounts_router


def create_application() -> FastAPI:
    app = FastAPI(title="POSTIKA API")

    # -----------------------------
    # ✅ CORS (FIXED)
    # -----------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https:\/\/.*\.app\.github\.dev",  # ✅ handles Codespaces frontend
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://postika.co.ke",
            "https://www.postika.co.ke",
            "https://api.postika.co.ke",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -----------------------------
    # Health Check
    # -----------------------------
    @app.get("/")
    def root():
        return {"status": "ok", "service": "postika"}

    # -----------------------------
    # ✅ STARTUP (CORRECT ORDER)
    # -----------------------------
    @app.on_event("startup")
    async def startup_event():
        # 1. Create tables FIRST
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # 2. Start scheduler (idempotent)
        if not hasattr(app.state, "scheduler_started"):
            app.state.scheduler_started = True
            asyncio.create_task(campaign_scheduler())

    # -----------------------------
    # Static Files
    # -----------------------------
    if settings.STORAGE_PROVIDER_NORMALIZED == "local":
        app.mount(
            settings.MEDIA_URL,
            StaticFiles(directory=settings.MEDIA_ROOT),
            name="media",
        )

    # -----------------------------
    # API Routers
    # -----------------------------
    api_prefix = "/api/v1"

    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(tenants_router, prefix=api_prefix)
    app.include_router(tenant_invitations_router, prefix=api_prefix)
    app.include_router(platform_invitations_router, prefix=api_prefix)
    app.include_router(sales_router, prefix=api_prefix)
    app.include_router(platform_sales_router, prefix=api_prefix)

    # Catalog
    app.include_router(catalog_router, prefix=api_prefix)
    app.include_router(catalog_alias_router, prefix=api_prefix)

    app.include_router(social_oauth_router, prefix=api_prefix)
    app.include_router(facebook_catalog_router, prefix=api_prefix)

    # Campaign creation/update
    app.include_router(
        campaign_router,
        prefix=f"{api_prefix}/campaigns",
        tags=["Campaign"],
    )

    # Campaign visibility
    app.include_router(
        campaigns_router,
        prefix=f"{api_prefix}",
    )

    # Templates
    app.include_router(
        templates_router,
        prefix=api_prefix,
    )

    # Posting
    app.include_router(posting_router, prefix=api_prefix)

    # AI
    app.include_router(ai_router, prefix=api_prefix)

    # Social Accounts
    app.include_router(social_accounts_router, prefix=api_prefix)

    return app


app = create_application()