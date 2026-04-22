// src/api/campaigns.ts
// Uses the shared api() transport which has the interceptor
// that injects Authorization + X-Tenant-Id on every request.
import { get, post } from "../lib/api";

export async function fetchCampaigns() {
  return await get<any[]>("/api/v1/campaigns");
}

export async function fetchCampaign(id: string) {
  return await get<any>(`/api/v1/campaigns/${id}`);
}

export async function fetchCampaignHistory(id: string) {
  return await get<any[]>(`/api/v1/campaigns/${id}/history`);
}

export default {
  fetchCampaigns,
  fetchCampaign,
  fetchCampaignHistory,
};