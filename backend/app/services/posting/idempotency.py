# app/services/posting/idempotency.py

def build_idempotency_key(tenant_id, platform, page_id, campaign_id):
    return f"{tenant_id}:{platform}:{page_id}:{campaign_id}"