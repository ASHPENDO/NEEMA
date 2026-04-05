import { Campaign, PostHistory } from "../types/campaign";

const API_BASE = "http://localhost:8000/api/v1";

export async function fetchCampaigns(token: string): Promise<Campaign[]> {
  const res = await fetch(`${API_BASE}/campaigns/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function fetchCampaign(id: string, token: string): Promise<Campaign> {
  const res = await fetch(`${API_BASE}/campaigns/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function fetchCampaignHistory(
  id: string,
  token: string
): Promise<PostHistory[]> {
  const res = await fetch(`${API_BASE}/campaigns/${id}/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}