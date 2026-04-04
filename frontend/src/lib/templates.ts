// src/lib/templates.ts

import type { CatalogItem } from "./api";

/* ---------------- TYPES ---------------- */

export type GeneratedPost = {
  caption: string;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  generate: (product: CatalogItem, allProducts?: CatalogItem[]) => GeneratedPost;
};

/* ---------------- HELPERS ---------------- */

function formatPrice(amount?: number, currency?: string) {
  if (!amount) return "";
  return `${currency || "KES"} ${amount.toLocaleString()}`;
}

function safe(value?: string | null) {
  return value || "";
}

/* ---------------- TEMPLATE 1 ---------------- */
/* SINGLE PRODUCT — HIGH CONVERSION */

const templateHighConversion: Template = {
  id: "high_conversion",
  name: "High Conversion",
  description: "Single product focused — designed to trigger immediate action",

  generate: (product) => {
    return {
      caption: `🔥 ${safe(product.title)}

💰 ${formatPrice(product.price_amount, product.price_currency)}

${safe(product.description)}

🚚 Delivery available
📩 DM now before it's gone!`,
    };
  },
};

/* ---------------- TEMPLATE 2 ---------------- */
/* MULTI PRODUCT — DISCOVERY */

const templateMultiProduct: Template = {
  id: "multi_product",
  name: "Multi Product (Discovery)",
  description: "Show multiple products to attract browsing customers",

  generate: (_product, allProducts = []) => {
    const top = allProducts.slice(0, 3);

    const list = top
      .map(
        (p) =>
          `- ${safe(p.title)} — ${formatPrice(p.price_amount, p.price_currency)}`
      )
      .join("\n");

    return {
      caption: `🛍️ Available now:

${list}

📍 Nairobi
📩 Message us to order`,
    };
  },
};

/* ---------------- TEMPLATE 3 ---------------- */
/* PROMO / OFFER */

const templatePromo: Template = {
  id: "promo_offer",
  name: "Promo / Offer",
  description: "Highlight deals and promotions",

  generate: (product) => {
    return {
      caption: `🔥 LIMITED OFFER!

${safe(product.title)}

Now ${formatPrice(product.price_amount, product.price_currency)}

⚡ Don't miss out!
📩 DM to order`,
    };
  },
};

/* ---------------- TEMPLATE 4 ---------------- */
/* COLLECTION (VERY POWERFUL) */

const templateCollection: Template = {
  id: "collection",
  name: "Collection",
  description: "Group products into a lifestyle or category",

  generate: (_product, allProducts = []) => {
    const top = allProducts.slice(0, 3);

    const list = top.map((p) => `- ${safe(p.title)}`).join("\n");

    return {
      caption: `✨ Featured Collection:

${list}

Upgrade your space today 🏡
📩 Message us to choose yours`,
    };
  },
};

/* ---------------- TEMPLATE 5 ---------------- */
/* PRICE DROP (RE-ENGAGEMENT) */

const templatePriceDrop: Template = {
  id: "price_drop",
  name: "Price Drop",
  description: "Re-engage users with reduced pricing",

  generate: (product) => {
    return {
      caption: `⚡ PRICE DROP!

${safe(product.title)}

Now ${formatPrice(product.price_amount, product.price_currency)}

📉 Limited time only
📩 DM before stock runs out`,
    };
  },
};

/* ---------------- EXPORT ---------------- */

export const templates: Template[] = [
  templateHighConversion,
  templateMultiProduct,
  templatePromo,
  templateCollection,
  templatePriceDrop,
];