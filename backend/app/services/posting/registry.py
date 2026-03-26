# app/services/posting/registry.py

from app.services.posting.platforms.facebook import FacebookPoster

PLATFORM_REGISTRY = {
    "facebook": FacebookPoster(),
    # "instagram": InstagramPoster(),  ← plug later
    # "tiktok": TikTokPoster(),
}