import React from "react";

type Props = {
  campaign: any;
  onClick?: () => void;
};

export default function CampaignCard({ campaign, onClick }: Props) {
  if (!campaign) return null;

  const id = campaign?.id ?? "—";
  const status = campaign?.status ?? "unknown";
  const caption = campaign?.caption ?? "No caption";
  const image = campaign?.media_url ?? campaign?.image_url ?? null;
  const platforms = Array.isArray(campaign?.platforms)
    ? campaign.platforms.join(", ")
    : "—";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-slate-300 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        {image && (
          <img
            src={image}
            alt="campaign"
            className="w-20 h-20 object-cover rounded-lg border"
          />
        )}

        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900 line-clamp-2">
            {caption}
          </div>

          <div className="mt-2 text-xs text-slate-500 break-all">
            {id}
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
              {platforms}
            </span>

            <span
              className={`px-2 py-1 rounded ${
                status === "posted"
                  ? "bg-green-100 text-green-700"
                  : status === "processing"
                  ? "bg-yellow-100 text-yellow-800"
                  : status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}