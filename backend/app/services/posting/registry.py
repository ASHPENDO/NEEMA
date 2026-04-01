# app/services/posting/registry.py

from app.services.posting.platforms.facebook import FacebookAdapter


facebook_adapter = FacebookAdapter()

PLATFORM_REGISTRY = {
    "facebook": facebook_adapter,
}