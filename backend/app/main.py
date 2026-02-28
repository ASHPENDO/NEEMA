from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings  # noqa: F401
import app.models  # noqa: F401  # force model registration

from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.tenant_invitations import router as tenant_invitations_router
from app.api.v1.platform_invitations import router as platform_invitations_router
from app.api.v1.sales import router as sales_router
from app.api.v1.platform_sales import router as platform_sales_router
from app.api.v1.catalog import router as catalog_router


def create_application() -> FastAPI:
    app = FastAPI(title="POSTIKA API")

    # ✅ CORS Configuration (Dev + Production + Codespaces)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            # 🔹 Local development (Vite frontend)
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            # 🔹 Production domains
            "https://postika.co.ke",
            "https://www.postika.co.ke",
            "https://api.postika.co.ke",
        ],
        # 🔹 GitHub Codespaces / *.app.github.dev domains
        allow_origin_regex=r"^https:\/\/.*\.app\.github\.dev$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {"status": "ok", "service": "postika"}

    # Routers
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(tenants_router, prefix="/api/v1")
    app.include_router(tenant_invitations_router, prefix="/api/v1")
    app.include_router(platform_invitations_router, prefix="/api/v1")
    app.include_router(sales_router, prefix="/api/v1")
    app.include_router(platform_sales_router, prefix="/api/v1")
    app.include_router(catalog_router, prefix="/api/v1")

    return app


app = create_application()