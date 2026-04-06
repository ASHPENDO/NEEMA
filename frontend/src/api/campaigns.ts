const BASE_URL = "http://localhost:8000/api/v1";

function getToken(): string {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

async function fetchCampaigns() {
  try {
    const res = await fetch(`${BASE_URL}/campaigns/`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("fetchCampaigns failed:", e);
    return [];
  }
}

export default {
  fetchCampaigns,
};