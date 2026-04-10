// types/campaign.ts — POSTIKA
// Extended from original type — backward compatible.
// Added: product_ids, media_urls, created_at, updated_at, template_id

export type Campaign = {
  id: string;
  caption: string;
  // Original single media field — kept for backward compat
  media_url: string | null;
  // Multi-product media list
  media_urls?: string[];
  status: "scheduled" | "processing" | "posted" | "failed" | "draft";
  scheduled_at: string | null;
  created_at?: string;
  updated_at?: string;
  platforms: string[];
  page_ids: string[];
  // Multi-product IDs (replaces single product_id)
  product_ids?: string[];
  template_id?: string;
};

export type PostHistory = {
  id: string;
  status: string;
  // Original field — kept as-is
  external_post_id: string | null;
  created_at: string;
};

// ── Request types ─────────────────────────────────────────────────────────────

export type CreateCampaignRequest = {
  caption: string;
  // product_ids[] — not product_id
  product_ids: string[];
  template_id?: string;
  page_ids: string[];
  platforms: string[];
  // Multi-image
  media_urls?: string[];
  // Legacy fallback
  media_url?: string;
  scheduled_at?: string;
};

export type UpdateCampaignRequest = Partial<CreateCampaignRequest>;

// ── AI generation ─────────────────────────────────────────────────────────────

export type AIGenerateRequest = {
  // product_ids[] for multi-product AI generation
  product_ids: string[];
  template_id?: string;
};

export type AIGenerateResponse = {
  full_caption?: string;
  caption?: string;
  text?: string;
  content?: string;
  result?: string;
};