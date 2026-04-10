import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useParams, useNavigate } from "react-router-dom";
import { post, del } from "../lib/api";
import { formatPrice } from "../utils/format";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  scheduled:  { cls: "bg-blue-100 text-blue-700",    dot: "bg-blue-500",   label: "Scheduled"  },
  processing: { cls: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", label: "Processing" },
  posted:     { cls: "bg-green-100 text-green-700",   dot: "bg-green-500",  label: "Posted"     },
  failed:     { cls: "bg-red-100 text-red-700",       dot: "bg-red-500",    label: "Failed"     },
  draft:      { cls: "bg-gray-100 text-gray-600",     dot: "bg-gray-400",   label: "Draft"      },
};

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? "").toLowerCase();
  const m = STATUS_META[s] ?? { cls: "bg-gray-100 text-gray-500", dot: "bg-gray-400", label: status ?? "Unknown" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${m.cls}`}>
      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-KE", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<any>(null);
  const [history,  setHistory]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load — preserved original pattern ────────────────────────────────────
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

  // ── Retry ─────────────────────────────────────────────────────────────────
  async function handleRetry() {
    if (!id) return;
    try {
      setRetrying(true);
      await post(`/api/v1/campaigns/${id}/retry`);
      const c = await campaignsApi.fetchCampaign(id);
      setCampaign(c || null);
    } catch (err: any) {
      alert(err?.message || "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!id || !confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      setDeleting(true);
      await del(`/api/v1/campaigns/${id}`);
      navigate(-1);
    } catch (err: any) {
      alert(err?.message || "Delete failed.");
      setDeleting(false);
    }
  }

  // ── Loading — preserved from original ────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 text-gray-500 text-sm flex items-center gap-2">
        <Spinner /> Loading...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="mb-4 text-blue-500 text-sm">
          ← Back
        </button>
        <div className="text-red-500 text-sm">Campaign not found</div>
      </div>
    );
  }

  // ── Derived — preserve original fields ────────────────────────────────────
  const caption   = campaign?.caption ?? "No caption";
  const status    = campaign?.status  ?? "unknown";
  const platforms = Array.isArray(campaign?.platforms)
    ? campaign.platforms.join(", ")
    : "—";

  // ✅ Multi-image: prefer media_urls[], fall back to media_url / image_url
  const mediaUrls: string[] =
    Array.isArray(campaign?.media_urls) && campaign.media_urls.length > 0
      ? campaign.media_urls
      : campaign?.media_url
      ? [campaign.media_url]
      : campaign?.image_url
      ? [campaign.image_url]
      : [];

  // ✅ product_ids[]
  const productIds: string[] = Array.isArray(campaign?.product_ids) ? campaign.product_ids : [];

  // ✅ products[] with price data (if backend returns them embedded)
  const products: any[] = Array.isArray(campaign?.products) ? campaign.products : [];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">

      {/* Back — preserved from original */}
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-500 text-sm hover:text-blue-700 transition">
        ← Back
      </button>

      {/* Title + status */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1">{caption}</h1>
        <StatusBadge status={status} />
      </div>

      {/* ✅ Multi-image preview — media_urls?.map(...) */}
      {mediaUrls.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Media ({mediaUrls.length} image{mediaUrls.length > 1 ? "s" : ""})
          </p>
          <div className={`grid gap-2 ${
            mediaUrls.length === 1 ? "grid-cols-1"
            : mediaUrls.length === 2 ? "grid-cols-2"
            : "grid-cols-3"
          }`}>
            {mediaUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Product ${i + 1}`}
                className="rounded-xl w-full object-cover aspect-square border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ✅ Products with formatPrice — if backend returns embedded products */}
      {products.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Products ({products.length})
          </p>
          <div className="space-y-2">
            {products.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 border rounded-xl px-3 py-2">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    className="w-10 h-10 object-cover rounded-lg border shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                  {/* ✅ formatPrice with currency */}
                  <p className="text-xs text-gray-400">
                    {formatPrice(Number(p.price_amount), p.price_currency ?? "KES")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta — preserved original fields */}
      <div className="mt-4 space-y-1.5 text-sm text-slate-700 bg-gray-50 border rounded-xl p-4">
        <p><span className="font-semibold text-gray-500">Status:</span> {status}</p>
        <p><span className="font-semibold text-gray-500">Platforms:</span> {platforms}</p>
        {productIds.length > 0 && (
          <p>
            <span className="font-semibold text-gray-500">Products:</span>{" "}
            {productIds.length} product{productIds.length > 1 ? "s" : ""}
          </p>
        )}
        {campaign?.scheduled_at && (
          <p><span className="font-semibold text-gray-500">Scheduled:</span> {formatDate(campaign.scheduled_at)}</p>
        )}
        {campaign?.created_at && (
          <p><span className="font-semibold text-gray-500">Created:</span> {formatDate(campaign.created_at)}</p>
        )}
        {Array.isArray(campaign?.page_ids) && campaign.page_ids.length > 0 && (
          <p><span className="font-semibold text-gray-500">Page IDs:</span> {campaign.page_ids.join(", ")}</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-2 flex-wrap">
        {status === "failed" && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition"
          >
            {retrying && <Spinner />}
            {retrying ? "Retrying…" : "🔄 Retry Campaign"}
          </button>
        )}
        {(status === "draft" || status === "failed") && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition"
          >
            {deleting && <Spinner />}
            {deleting ? "Deleting…" : "Delete Campaign"}
          </button>
        )}
      </div>

      {/* Post History — preserved from original */}
      <h2 className="mt-7 font-semibold text-gray-800">Post History</h2>
      <div className="mt-2 space-y-2">
        {history.length === 0 && (
          <div className="text-sm text-gray-500">No history yet</div>
        )}
        {history.map((h: any) => (
          <div key={h?.id || Math.random()} className="p-3 bg-gray-100 rounded-xl text-sm">
            <p><span className="font-semibold text-gray-600">Status:</span> {h?.status ?? "unknown"}</p>
            <p><span className="font-semibold text-gray-600">Post ID:</span> {h?.external_post_id ?? "—"}</p>
            {h?.created_at && (
              <p className="text-xs text-gray-400 mt-1">{formatDate(h.created_at)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
