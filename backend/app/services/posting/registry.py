# app/services/posting/registry.py

from app.services.posting.platforms.facebook import FacebookAdapter

PLATFORM_REGISTRY = {
    "facebook": FacebookAdapter(),
}