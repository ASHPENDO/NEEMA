import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import { post, del } from "../lib/api";

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const navigate = useNavigate();

  async function loadCampaigns() {
    try {
      const data = await campaignsApi.fetchCampaigns();

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

  useEffect(() => {
    let mounted = true;

    async function load() {
      await loadCampaigns();
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ DELETE
  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;

    try {
      setLoadingId(id);
      await del(`/api/v1/campaigns/${id}`);
      await loadCampaigns();
    } catch {
      alert("Failed to delete campaign");
    } finally {
      setLoadingId(null);
    }
  }

  // ✅ RETRY
  async function handleRetry(id: string) {
    try {
      setLoadingId(id);
      await post(`/api/v1/campaigns/${id}/retry`);
      await loadCampaigns();
    } catch {
      alert("Failed to retry campaign");
    } finally {
      setLoadingId(null);
    }
  }

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

      {/* ERROR */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* FILTERS */}
      <div className="mb-4 flex gap-2">
        {["all", "draft", "failed", "posted", "processing"].map((f) => (
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
            <div
              key={c?.id ?? Math.random()}
              className="flex justify-between items-center border rounded p-3"
            >
              <CampaignCard
                campaign={c}
                onClick={() => {
                  if (c?.id) navigate(`/campaigns/${c.id}`);
                }}
              />

              {/* ✅ ACTIONS */}
              <div className="flex gap-2 ml-4">
                {(c.status === "draft" || c.status === "failed") && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={loadingId === c.id}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    {loadingId === c.id ? "..." : "Delete"}
                  </button>
                )}

                {c.status === "failed" && (
                  <button
                    onClick={() => handleRetry(c.id)}
                    disabled={loadingId === c.id}
                    className="bg-yellow-600 text-white px-3 py-1 rounded"
                  >
                    {loadingId === c.id ? "..." : "Retry"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}