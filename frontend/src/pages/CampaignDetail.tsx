import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useParams, useNavigate } from "react-router-dom";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const c = await campaignsApi.fetchCampaign(id);
        const h = await campaignsApi.fetchCampaignHistory(id);

        setCampaign(c || null);
        setHistory(Array.isArray(h) ? h : []);
      } catch (error) {
        console.error("CampaignDetail error:", error);
        setCampaign(null);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="mb-4 text-blue-500">
          ← Back
        </button>
        <div className="text-red-500">Campaign not found</div>
      </div>
    );
  }

  const caption = campaign?.caption ?? "No caption";
  const image = campaign?.media_url ?? campaign?.image_url ?? null;
  const status = campaign?.status ?? "unknown";
  const platforms = Array.isArray(campaign?.platforms)
    ? campaign.platforms.join(", ")
    : "—";

  return (
    <div className="p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-500">
        ← Back
      </button>

      <h1 className="text-xl font-bold">{caption}</h1>

      {image && (
        <img
          src={image}
          alt="campaign"
          className="rounded-xl mt-4 w-full max-w-md"
        />
      )}

      <div className="mt-4 space-y-1 text-sm text-slate-700">
        <p>Status: {status}</p>
        <p>Platforms: {platforms}</p>
      </div>

      <h2 className="mt-6 font-semibold">Post History</h2>

      <div className="mt-2 space-y-2">
        {history.length === 0 && (
          <div className="text-sm text-gray-500">No history yet</div>
        )}

        {history.map((h: any) => (
          <div key={h?.id || Math.random()} className="p-3 bg-gray-100 rounded">
            <p>Status: {h?.status ?? "unknown"}</p>
            <p>Post ID: {h?.external_post_id ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}