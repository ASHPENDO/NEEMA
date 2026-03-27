from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import asyncio

from app.core.config import settings
import app.models  # noqa: F401

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.tenant_invitations import router as tenant_invitations_router
from app.api.v1.platform_invitations import router as platform_invitations_router
from app.api.v1.sales import router as sales_router
from app.api.v1.platform_sales import router as platform_sales_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.social_oauth import router as social_oauth_router
from app.api.v1.facebook_catalog import router as facebook_catalog_router

# ✅ Unified posting
from app.api.v1.endpoints.posting import router as posting_router

# ✅ Scheduler
from app.services.scheduler import campaign_scheduler
from app.api.v1.campaigns import router as campaigns_router

def create_application() -> FastAPI:
    app = FastAPI(title="POSTIKA API")

    # -----------------------------
    # CORS
    # -----------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://postika.co.ke",
            "https://www.postika.co.ke",
            "https://api.postika.co.ke",
        ],
        allow_origin_regex=r"^https:\/\/.*\.app\.github\.dev$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -----------------------------
    # Root Health Check
    # -----------------------------
    @app.get("/")
    def root():
        return {"status": "ok", "service": "postika"}

    # -----------------------------
    # Scheduler Startup
    # -----------------------------
    @app.on_event("startup")
    async def start_scheduler():
        # Prevent duplicate schedulers in reload mode
        if not hasattr(app.state, "scheduler_started"):
            app.state.scheduler_started = True
            asyncio.create_task(campaign_scheduler())

    # -----------------------------
    # Static Media (Local Only)
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
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(tenants_router, prefix="/api/v1")
    app.include_router(tenant_invitations_router, prefix="/api/v1")
    app.include_router(platform_invitations_router, prefix="/api/v1")
    app.include_router(sales_router, prefix="/api/v1")
    app.include_router(platform_sales_router, prefix="/api/v1")
    app.include_router(catalog_router, prefix="/api/v1")
    app.include_router(social_oauth_router, prefix="/api/v1")
    app.include_router(facebook_catalog_router, prefix="/api/v1")
    app.include_router(campaigns_router, prefix="/api/v1")
    # ✅ Posting system
    app.include_router(posting_router, prefix="/api/v1")

    return app


app = create_application()