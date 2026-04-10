import { useEffect, useState } from "react";
import campaignsApi from "../api/campaigns";
import { useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import { post, del } from "../lib/api";

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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// ─────────────────────────────────────────────────────────────────────────────

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  // ── Load ──────────────────────────────────────────────────────────────────
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
    async function load() { await loadCampaigns(); }
    load();
    return () => { mounted = false; };
  }, []);

  // Reset to page 1 when filter/search/pageSize changes
  useEffect(() => { setPage(1); }, [filter, search, pageSize]);

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
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

  // ── Retry ─────────────────────────────────────────────────────────────────
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = campaigns.filter((c) => {
    const matchStatus = filter === "all" ? true : c?.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c?.caption?.toLowerCase().includes(q) ||
      c?.id?.toLowerCase().includes(q) ||
      c?.platforms?.some((p: string) => p.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  // ── Pagination bar ────────────────────────────────────────────────────────
  function PaginationBar() {
    if (totalPages <= 1 && filtered.length <= pageSize) return null;

    const makeRange = (): (number | "…")[] => {
      const delta = 2;
      const result: (number | "…")[] = [];
      const left = Math.max(2, safePage - delta);
      const right = Math.min(totalPages - 1, safePage + delta);
      result.push(1);
      if (left > 2) result.push("…");
      for (let i = left; i <= right; i++) result.push(i);
      if (right < totalPages - 1) result.push("…");
      if (totalPages > 1) result.push(totalPages);
      return result;
    };

    const btn = (active: boolean, disabled: boolean) =>
      `px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : disabled
          ? "text-gray-300 cursor-not-allowed border-gray-200"
          : "text-gray-600 hover:bg-gray-100 border-gray-200"
      }`;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          Show
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border rounded px-2 py-1 text-xs bg-white focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          per page · <strong>{filtered.length}</strong> total
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setPage(1)} disabled={safePage === 1} className={btn(false, safePage === 1)}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className={btn(false, safePage === 1)}>‹</button>
          {makeRange().map((r, i) =>
            r === "…"
              ? <span key={`e${i}`} className="px-1 text-gray-400 text-xs">…</span>
              : <button key={r} onClick={() => setPage(r as number)} className={btn(safePage === r, false)}>{r}</button>
          )}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className={btn(false, safePage === totalPages)}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className={btn(false, safePage === totalPages)}>»</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="mb-5 flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button
          onClick={() => navigate("/campaigns/create")}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition"
        >
          + Create Campaign
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={loadCampaigns} className="underline font-bold text-xs ml-4">Retry</button>
        </div>
      )}

      {/* Search + Status filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />

        {/* Status filter buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {["all", "draft", "scheduled", "processing", "posted", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize ${
                filter === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {f === "all" ? "All" : f}
              {/* Count badge */}
              {f !== "all" && (
                <span className="ml-1 opacity-60">
                  ({campaigns.filter((c) => c?.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        {paginated.length === 0 && !error && (
          <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-6 text-center">
            {campaigns.length === 0
              ? "No campaigns yet. Create your first one →"
              : "No campaigns match your filters."}
          </div>
        )}

        <div className="space-y-3 mt-1">
          {paginated.map((c: any) => (
            <div
              key={c?.id ?? Math.random()}
              className="flex justify-between items-center border rounded-xl p-3 hover:bg-gray-50 transition gap-3"
            >
              {/* CampaignCard — unchanged, preserves existing component */}
              <div className="flex-1 min-w-0">
                <CampaignCard
                  campaign={c}
                  onClick={() => {
                    if (c?.id) navigate(`/campaigns/${c.id}`);
                  }}
                />
                {/* Status badge — added below card */}
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={c?.status} />
                  {/* ✅ product_ids count */}
                  {Array.isArray(c?.product_ids) && c.product_ids.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {c.product_ids.length} product{c.product_ids.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {/* Platforms */}
                  {Array.isArray(c?.platforms) && c.platforms.map((p: string) => (
                    <span key={p} className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-2 shrink-0 flex-wrap">
                {/* Retry — only for failed */}
                {c?.status === "failed" && (
                  <button
                    onClick={() => handleRetry(c.id)}
                    disabled={loadingId === c.id}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition"
                  >
                    {loadingId === c.id ? <Spinner /> : "🔄"} Retry
                  </button>
                )}

                {/* Delete — draft or failed */}
                {(c?.status === "draft" || c?.status === "failed") && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={loadingId === c.id}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition"
                  >
                    {loadingId === c.id ? <Spinner /> : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <PaginationBar />

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Showing {pageStart + 1}–{pageStart + paginated.length} of {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
