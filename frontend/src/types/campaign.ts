export interface Campaign {
  id: string;
  caption: string;
  media_url: string;
  status: "scheduled" | "processing" | "posted" | "failed";
  scheduled_at: string;
  platforms: string[];
  page_ids: string[];
}

export interface PostHistory {
  id: string;
  status: string;
  external_post_id: string;
  created_at: string;
}