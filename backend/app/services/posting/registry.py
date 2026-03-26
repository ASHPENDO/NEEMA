# app/services/posting/registry.py

from app.services.posting.platforms.facebook import FacebookAdapter

# Placeholder for future
# from app.services.posting.platforms.instagram import InstagramAdapter


PLATFORM_REGISTRY = {
    "facebook": FacebookAdapter(),
    # "instagram": InstagramAdapter(),  # enable when ready
}