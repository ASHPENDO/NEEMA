import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  // Initial load
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Auto refresh
  useEffect(() => {
    const interval = setInterval(loadCampaigns, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadCampaigns() {
    try {
      const data = await campaignsApi.fetchCampaigns();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("CampaignList error:", error);
      setCampaigns([]);
    }
  }

  const filtered = campaigns.filter((c) =>
    filter === "all" ? true : c?.status === filter
  );

  return (
    <div className="p-6 max-w-4xl">
      {/* ✅ HEADER WITH BUTTON */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaigns</h1>

        <button
          onClick={() => navigate("/campaigns/create")}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800"
        >
          + Create Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {["all", "posted", "processing"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        {filtered.length === 0 && (
          <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4">
            No campaigns yet. Create one to get started 🚀
          </div>
        )}

        <div className="space-y-3 mt-3">
          {filtered.map((c: any) => (
            <CampaignCard
              key={c?.id}
              campaign={c}
              onClick={() => {
                if (c?.id) navigate(`/campaigns/${c.id}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}