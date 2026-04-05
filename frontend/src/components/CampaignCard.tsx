import { Campaign } from "../types/campaign";

interface Props {
  campaign: Campaign;
  onClick: (campaign: Campaign) => void;
}

export default function CampaignCard({ campaign, onClick }: Props) {
  const statusColor: Record<string, string> = {
    scheduled: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    posted: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div
      onClick={() => onClick(campaign)}
      className="p-4 rounded-2xl shadow bg-white cursor-pointer hover:shadow-lg transition"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{campaign.caption}</h3>
        <span className={`text-xs px-2 py-1 rounded ${statusColor[campaign.status]}`}>
          {campaign.status}
        </span>
      </div>

      <div className="text-sm text-gray-500 mt-2">
        Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
      </div>
    </div>
  );
}