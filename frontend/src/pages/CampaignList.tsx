import { useEffect, useState } from "react";
import { fetchCampaigns } from "../api/campaigns";
import { Campaign } from "../types/campaign";
import CampaignCard from "../components/CampaignCard";
import { useNavigate } from "react-router-dom";

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const data = await fetchCampaigns();
      setCampaigns(data);
    }

    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Campaigns</h1>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            onClick={() => navigate(`/campaigns/${c.id}`)}
          />
        ))}
      </div>
    </div>
  );
}