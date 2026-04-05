import { useEffect, useState } from "react";
import { fetchCampaign, fetchCampaignHistory } from "../api/campaigns";
import { Campaign, PostHistory } from "../types/campaign";
import { useParams, useNavigate } from "react-router-dom";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [history, setHistory] = useState<PostHistory[]>([]);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const c = await fetchCampaign(id);
      const h = await fetchCampaignHistory(id);

      setCampaign(c);
      setHistory(h);
    }

    load();
  }, [id]);

  if (!campaign) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-500">
        ← Back
      </button>

      <h1 className="text-xl font-bold">{campaign.caption}</h1>

      <img
        src={campaign.media_url}
        className="rounded-xl mt-4 w-full max-w-md"
      />

      <div className="mt-4">
        <p>Status: {campaign.status}</p>
        <p>Platforms: {campaign.platforms.join(", ")}</p>
      </div>

      <h2 className="mt-6 font-semibold">Post History</h2>

      <div className="mt-2 space-y-2">
        {history.map((h) => (
          <div key={h.id} className="p-3 bg-gray-100 rounded">
            <p>Status: {h.status}</p>
            <p>Post ID: {h.external_post_id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}