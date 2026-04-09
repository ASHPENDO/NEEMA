from openai import AsyncOpenAI

from app.core.config import settings
from app.models.catalog_item import CatalogItem
from app.models.template import Template


client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class AIContentService:

    @staticmethod
    async def generate(db, product_id, template_id=None):

        # ==============================
        # FETCH PRODUCT
        # ==============================
        product = await db.get(CatalogItem, product_id)

        if not product:
            raise ValueError("Invalid product")

        # ==============================
        # OPTIONAL TEMPLATE
        # ==============================
        template = None
        if template_id:
            template = await db.get(Template, template_id)

        # ==============================
        # BASE PROMPT
        # ==============================
        base_prompt = f"""
Product:
- Name: {product.title}
- Price: {product.price_amount} {product.price_currency}
- Description: {getattr(product, "description", "")}

Generate a high-converting social media caption.
Include:
- Hook
- Value proposition
- CTA
- Emojis
"""

        if template:
            prompt = f"""
{base_prompt}

Template Style:
{template.name}
"""
        else:
            prompt = base_prompt

        # ==============================
        # OPENAI CALL (SAFE WRAPPED)
        # ==============================
        try:
            response = await client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": "You are a marketing expert."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )

            return response.choices[0].message.content

        except Exception as e:
            error_str = str(e)

            print(f"[AI ERROR] {error_str}")

            # ==============================
            # ✅ QUOTA FALLBACK
            # ==============================
            if "insufficient_quota" in error_str:
                return f"""
🔥 {product.title}

💰 Only {product.price_amount} {product.price_currency}!

✨ Don't miss out — limited offer.

👉 Order now!
"""

            # ==============================
            # ⚠️ GENERIC FALLBACK (SAFE)
            # ==============================
            return f"""
🔥 {product.title}

Great value at {product.price_amount} {product.price_currency}.

👉 Get yours today!
"""