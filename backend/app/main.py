from fastapi import FastAPI

from app.core.config import settings  # noqa: F401
import app.models  # noqa: F401  # force model registration

from app.api.v1.auth import router as auth_router


def create_application() -> FastAPI:
    app = FastAPI(title="POSTIKA API")

    @app.get("/")
    def root():
        return {"status": "ok", "service": "postika"}

    app.include_router(auth_router, prefix="/api/v1")
    return app


app = create_application()
