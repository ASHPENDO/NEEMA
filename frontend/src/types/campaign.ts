export type Campaign = {
  id: string;
  caption: string;
  media_url: string | null;
  status: "scheduled" | "processing" | "posted" | "failed";
  scheduled_at: string | null;
  platforms: string[];
  page_ids: string[];
};

export type PostHistory = {
  id: string;
  status: string;
  external_post_id: string | null;
  created_at: string;
};