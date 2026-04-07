import axios from "axios";

// ✅ SAFE BASE (bypasses broken api.ts)
const BASE_URL = "http://localhost:8000/api/v1";

const client = axios.create({
  baseURL: BASE_URL,
});

export async function fetchCampaigns() {
  const res = await client.get("/campaigns");
  return res.data;
}

export async function fetchCampaign(id: string) {
  const res = await client.get(`/campaigns/${id}`);
  return res.data;
}

export async function fetchCampaignHistory(id: string) {
  const res = await client.get(`/campaigns/${id}/history`);
  return res.data;
}

export default {
  fetchCampaigns,
  fetchCampaign,
  fetchCampaignHistory,
};