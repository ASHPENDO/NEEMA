import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await campaignsApi.fetchCampaigns();

        if (!mounted) return;

        if (Array.isArray(data)) {
          setCampaigns(data);
        } else {
          console.warn("Unexpected response:", data);
          setCampaigns([]);
        }
      } catch (err: any) {
        console.error("CampaignList error:", err);
        setError("Failed to load campaigns");
        setCampaigns([]);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = campaigns.filter((c) =>
    filter === "all" ? true : c?.status === filter
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaigns</h1>

        <button
          onClick={() => navigate("/campaigns/create")}
          className="bg-slate-900 text-white px-4 py-2 rounded"
        >
          + Create Campaign
        </button>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* FILTERS */}
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
        {filtered.length === 0 && !error && (
          <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4">
            No campaigns yet.
          </div>
        )}

        <div className="space-y-3 mt-3">
          {filtered.map((c: any) => (
            <CampaignCard
              key={c?.id ?? Math.random()}
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