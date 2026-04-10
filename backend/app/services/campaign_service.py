from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.models.campaign import Campaign
from app.models.catalog_item import CatalogItem


class CampaignService:
    """
    Service wrapper to maintain compatibility with scheduler/tasks.
    """

    @staticmethod
    async def create_campaign(db: AsyncSession, tenant_id, data):

        # ==============================
        # STATUS (MVP: always scheduled)
        # ==============================
        status = "scheduled"

        # ==============================
        # NORMALIZE PRODUCTS
        # ==============================
        product_ids = list(data.product_ids or [])

        if data.product_id:
            product_ids.append(data.product_id)

        # remove duplicates
        product_ids = list(set(product_ids))

        if not product_ids:
            raise ValueError("At least one product is required")

        # ==============================
        # FETCH PRODUCTS
        # ==============================
        products = []
        for pid in product_ids:
            product = await db.get(CatalogItem, pid)
            if product:
                products.append(product)

        if not products:
            raise ValueError("Invalid products")

        # ==============================
        # MEDIA HANDLING
        # ==============================
        media_urls = [p.image_url for p in products if p.image_url]

        # fallback for single product (legacy support)
        media_url = media_urls[0] if media_urls else None

        # ==============================
        # DETERMINE PRIMARY PRODUCT (IMPORTANT)
        # ==============================
        # Required because DB still enforces product_id NOT NULL
        primary_product_id = data.product_id or product_ids[0]

        # ==============================
        # CREATE CAMPAIGN
        # ==============================
        campaign = Campaign(
            tenant_id=tenant_id,

            # CORE LINKS
            product_id=primary_product_id,  # ✅ always set
            product_ids=product_ids,        # ✅ new multi-product support
            template_id=data.template_id,

            # OPTIONAL
            name=getattr(data, "name", None),

            # DEFAULTS (SUNGURA)
            platforms=getattr(data, "platforms", ["facebook"]),
            page_ids=getattr(data, "page_ids", []),

            # CONTENT
            caption=data.caption,
            media_url=media_url,    # single fallback
            media_urls=media_urls,  # multi support

            # SCHEDULING
            scheduled_at=data.scheduled_at,

            # STATUS
            status=status,

            # TIMESTAMPS
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)

        return campaign