import asyncio

from app.db.session import async_session_maker
from app.models.template import Template
from sqlalchemy import select


async def run():
    async with async_session_maker() as db:
        templates = [
            {
                "name": "High Conversion",
                "description": "Optimized for maximum engagement and conversions"
            },
            {
                "name": "Promo / Offer",
                "description": "Highlights discounts and limited-time offers"
            },
            {
                "name": "Price Drop",
                "description": "Emphasizes reduced pricing and urgency"
            },
            {
                "name": "Multi Product (Discovery)",
                "description": "Showcases multiple products for discovery and browsing"
            },
            {
                "name": "Collection",
                "description": "Groups related products into a themed collection"
            },
        ]

        for t in templates:
            result = await db.execute(
                select(Template).where(Template.name == t["name"])
            )
            exists = result.scalar_one_or_none()

            if not exists:
                db.add(Template(**t))

        await db.commit()


if __name__ == "__main__":
    asyncio.run(run())