import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { get, post, type CatalogItem } from "../lib/api";

// ─── Types matching actual API responses ──────────────────────────────────────

interface Template {
  id: string;
  name: string;
  tone?: string;
}

interface SocialAccount {
  page_id: string;
  page_name?: string;
  platform?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateCampaign() {
  const navigate = useNavigate();

  // Data lists
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pages, setPages] = useState<SocialAccount[]>([]);

  // Selections — store actual ID strings
  const [productId, setProductId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [pageId, setPageId] = useState("");

  // Caption
  const [caption, setCaption] = useState("");

  // UI state
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Derived — selected objects for display
  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const selectedPage = pages.find((p) => p.page_id === pageId) ?? null;

  const canGenerate = !!productId;
  const canSubmit =
    !!productId && !!templateId && !!pageId && caption.trim().length > 0;

  // ─── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setDataLoading(true);
      setDataError("");

      // ✅ get<T>() returns T directly — NO .data wrapper
      const [items, tRes, sRes] = await Promise.all([
        get<CatalogItem[]>("/api/v1/catalog/items"),
        get<Template[]>("/api/v1/templates/"),
        get<SocialAccount[]>("/api/v1/social-accounts/"),
      ]);

      setProducts(Array.isArray(items) ? items : []);
      setTemplates(Array.isArray(tRes) ? tRes : []);
      setPages(Array.isArray(sRes) ? sRes : []);
    } catch (err: any) {
      setDataError(err?.message || "Failed to load data. Please refresh.");
    } finally {
      setDataLoading(false);
    }
  }

  // ─── Generate AI caption ────────────────────────────────────────────────────

  async function handleGenerateAI() {
    if (!productId) return;

    try {
      setAiLoading(true);
      setCaption("");

      const payload: Record<string, string> = { product_id: productId };
      if (templateId) payload.template_id = templateId;

      // ✅ post<T>() returns T directly — no .data
      const data = await post<any>("/api/v1/ai/generate", payload);

      const text =
        typeof data === "string"
          ? data
          : data?.full_caption || data?.caption || "";

      if (!text) {
        alert("AI returned an empty response. Try again.");
      } else {
        setCaption(text);
      }
    } catch (err: any) {
      alert(err?.message || "AI generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Submit campaign ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitting(true);

      await post("/api/v1/campaigns", {
        caption: caption.trim(),
        product_id: productId,
        template_id: templateId,
        page_ids: [pageId],
        platforms: [selectedPage?.platform ?? "facebook"],
        media_url: selectedProduct?.image_url ?? "",
      });

      navigate("/campaigns");
    } catch (err: any) {
      alert(err?.message || "Failed to create campaign. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500 text-sm">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading campaign data…
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1 text-gray-900">Create Campaign</h1>
      <p className="text-sm text-gray-500 mb-6">
        Pick a product, template, and page — then generate your AI caption and publish.
      </p>

      {/* Data error banner */}
      {dataError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>⚠ {dataError}</span>
          <button onClick={loadAll} className="underline text-xs ml-4 font-semibold">
            Retry
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. PRODUCT ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product <span className="text-red-500">*</span>
          </label>

          {products.length === 0 ? (
            <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-lg p-3">
              No products found. Go to Catalog and add products first.
            </p>
          ) : (
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setCaption(""); // clear stale caption on product change
              }}
              className="w-full border rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.price_amount
                    ? ` · ${p.price_currency ?? "KES"} ${Number(p.price_amount).toLocaleString()}`
                    : ""}
                </option>
              ))}
            </select>
          )}

          {/* Product preview card */}
          {selectedProduct && (
            <div className="mt-2 p-3 bg-gray-50 border rounded-lg flex items-center gap-3">
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.title}
                  className="w-12 h-12 object-cover rounded border flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                  IMG
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">{selectedProduct.title}</p>
                <p className="text-xs text-gray-500">{selectedProduct.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. TEMPLATE ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Template <span className="text-red-500">*</span>
          </label>

          {templates.length === 0 ? (
            <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-lg p-3">
              No templates found. Create a template first.
            </p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setCaption(""); // clear stale caption on template change
              }}
              className="w-full border rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {selectedTemplate && (
            <p className="text-xs text-gray-400 mt-1">
              ✓ <strong>{selectedTemplate.name}</strong> will set the caption tone.
            </p>
          )}
        </div>

        {/* ── 3. PAGE ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Page / Social Account <span className="text-red-500">*</span>
          </label>

          {pages.length === 0 ? (
            <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-lg p-3">
              No connected pages. Connect a social account first.
            </p>
          ) : (
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a page —</option>
              {pages.map((p) => (
                <option key={p.page_id} value={p.page_id}>
                  {p.page_name || p.page_id}
                  {p.platform ? ` (${p.platform})` : ""}
                </option>
              ))}
            </select>
          )}

          {selectedPage && (
            <p className="text-xs text-gray-400 mt-1">
              ✓ Posting to <strong>{selectedPage.page_name || selectedPage.page_id}</strong>
              {selectedPage.platform ? ` on ${selectedPage.platform}` : ""}
            </p>
          )}
        </div>

        {/* ── 4. CAPTION ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Caption <span className="text-red-500">*</span>
          </label>

          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={aiLoading || !canGenerate}
            className="w-full mb-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {aiLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating…
              </>
            ) : (
              <>✨ Generate with AI</>
            )}
          </button>

          {!canGenerate && (
            <p className="text-xs text-gray-400 mb-2">Select a product above to enable AI generation.</p>
          )}

          <textarea
            placeholder="Caption will appear here after AI generation, or type your own…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={5}
            disabled={aiLoading}
            className="w-full border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            You can edit the AI-generated caption before submitting.
          </p>
        </div>

        {/* ── READINESS CHECKLIST ── */}
        <div className="bg-gray-50 border rounded-lg p-3 text-xs space-y-1">
          <p className="font-semibold text-gray-600 mb-1">Ready to publish?</p>
          <p className={productId ? "text-green-600" : "text-gray-400"}>
            {productId ? "✓" : "○"} Product{selectedProduct ? ` — ${selectedProduct.title}` : ""}
          </p>
          <p className={templateId ? "text-green-600" : "text-gray-400"}>
            {templateId ? "✓" : "○"} Template{selectedTemplate ? ` — ${selectedTemplate.name}` : ""}
          </p>
          <p className={pageId ? "text-green-600" : "text-gray-400"}>
            {pageId ? "✓" : "○"} Page{selectedPage ? ` — ${selectedPage.page_name || selectedPage.page_id}` : ""}
          </p>
          <p className={caption.trim() ? "text-green-600" : "text-gray-400"}>
            {caption.trim() ? "✓" : "○"} Caption ready
          </p>
        </div>

        {/* ── SUBMIT ── */}
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold text-sm transition"
        >
          {submitting ? "Creating campaign…" : "Create Campaign"}
        </button>

      </form>
    </div>
  );
}
