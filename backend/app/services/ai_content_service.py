from openai import AsyncOpenAI

from app.core.config import settings
from app.models.catalog_item import CatalogItem
from app.models.template import Template
from app.models.tenant import Tenant

import json


client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class AIContentService:

    @staticmethod
    async def generate(db, product_id=None, template_id=None, product_ids=None):

        # ==============================
        # MULTI-PRODUCT MODE (ENHANCED)
        # ==============================
        if product_ids:

            products = []
            for pid in product_ids:
                p = await db.get(CatalogItem, pid)
                if p:
                    products.append(p)

            if not products:
                raise ValueError("Invalid products")

            base_product = products[0]

            tenant = None
            if hasattr(base_product, "tenant_id"):
                tenant = await db.get(Tenant, base_product.tenant_id)

            if not tenant:
                raise ValueError("Tenant not found for product")

            location = getattr(tenant, "business_location", "") or "your area"
            contact = (
                getattr(tenant, "phone_number", None)
                or getattr(tenant, "whatsapp_number", None)
                or "contact us"
            )

            # ==============================
            # CATEGORY EMOJI (NEW)
            # ==============================
            def get_category_emoji(name: str):
                name = name.lower()
                if "phone" in name or "iphone" in name:
                    return "📱"
                if "shoe" in name or "sneaker" in name:
                    return "👟"
                if "laptop" in name:
                    return "💻"
                return "🔥"

            # ==============================
            # PRODUCT TEXT (WITH STOCK)
            # ==============================
            def format_product(p):
                stock_text = ""
                if hasattr(p, "stock") and p.stock:
                    stock_text = f" (Only {p.stock} left)"
                return f"- {p.title} ({p.price_amount} {p.price_currency}){stock_text}"

            product_list_text = "\n".join([
                format_product(p)
                for p in products[:3]
            ])

            emoji = get_category_emoji(base_product.title)

            prompt = f"""
You are generating a HIGH-CONVERTING Facebook ad for an SME in East Africa.

{emoji} PRODUCTS:
{product_list_text}

BUSINESS:
Location: {location}
Contact: {contact}

CONVERSION RULES:
- Hook MUST include price or "starting from"
- Highlight urgency if stock is low
- Body should mention only 2–3 products
- Keep sentences short (mobile users)
- CTA MUST include:
  - location
  - WhatsApp or phone contact

STYLE:
- Energetic
- Sales-driven
- Use emojis naturally

OUTPUT FORMAT:
Return ONLY valid JSON:

{{
  "hook": "...",
  "body": "...",
  "cta": "...",
  "hashtags": ["...", "..."],
  "full_caption": "..."
}}
"""

            if template_id:
                template = await db.get(Template, template_id)
                if template:
                    prompt += f"\n\nSTYLE:\nUse this tone/style: {template.name}"

        # ==============================
        # SINGLE PRODUCT MODE (UNCHANGED)
        # ==============================
        else:
            product = await db.get(CatalogItem, product_id)

            if not product:
                raise ValueError("Invalid product")

            tenant = None
            if hasattr(product, "tenant_id"):
                tenant = await db.get(Tenant, product.tenant_id)

            if not tenant:
                raise ValueError("Tenant not found for product")

            template = None
            if template_id:
                template = await db.get(Template, template_id)

            product_name = product.title
            price = f"{product.price_amount} {product.price_currency}"
            description = getattr(product, "description", "") or ""

            location = getattr(tenant, "business_location", "") or "your area"
            contact = (
                getattr(tenant, "phone_number", None)
                or getattr(tenant, "whatsapp_number", None)
                or "contact us"
            )

            prompt = f"""
You are generating a high-converting Facebook ad caption for an SME in East Africa.

PRODUCT:
Name: {product_name}
Price: {price}
Description: {description}

BUSINESS:
Location: {location}
Contact: {contact}

INSTRUCTIONS:
- Hook MUST include the price
- Body MUST clearly describe the product
- CTA MUST include BOTH:
  - location
  - contact (call or WhatsApp)
- Keep it concise, persuasive, mobile-friendly
- Use natural emojis

OUTPUT FORMAT:
Return ONLY valid JSON:

{{
  "hook": "...",
  "body": "...",
  "cta": "...",
  "hashtags": ["...", "..."],
  "full_caption": "..."
}}
"""

            if template:
                prompt += f"\n\nSTYLE:\nUse this tone/style: {template.name}"

        # ==============================
        # OPENAI CALL
        # ==============================
        try:
            response = await client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": "You are a high-converting digital marketing expert."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )

            raw_output = response.choices[0].message.content.strip()

            try:
                result = json.loads(raw_output)
            except Exception:
                raise ValueError("AI did not return valid JSON")

            cta = result.get("cta", "")

            if "location" not in cta.lower():
                print("[WARN] CTA may be missing location")

            if "call" not in cta.lower() and "whatsapp" not in cta.lower():
                print("[WARN] CTA may be missing contact")

            return result

        except Exception as e:
            error_str = str(e)
            print(f"[AI ERROR] {error_str}")

            fallback = {
                "hook": "🔥 Hot Deals Available Now!",
                "body": "Check out our latest products at unbeatable prices.",
                "cta": "📍 Visit us today or contact us now!",
                "hashtags": ["#Deal", "#ShopNow"],
                "full_caption": "🔥 Hot Deals Available Now!\n\nCheck out our latest products.\n\n📍 Visit us or contact us now!",
            }

            return fallback