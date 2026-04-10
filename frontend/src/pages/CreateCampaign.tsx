/**
 * CreateCampaign.tsx — POSTIKA
 *
 * Multi-product campaign creation:
 * - Select multiple products with click-to-add/remove
 * - Scrollable product preview grid with remove button
 * - AI generate uses product_ids[] (not product_id)
 * - Submit payload uses product_ids[]
 * - Readiness checklist
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listCatalogItems, get, post, type CatalogItem } from "../lib/api";

interface Template {
  id: string;
  name: string;
}

interface SocialAccount {
  page_id: string;
  page_name?: string;
  platform?: string;
}

function stripHtml(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim();
}

function formatPrice(item: CatalogItem): string {
  if (item.price_amount == null) return "";
  const n = Number(item.price_amount);
  return isNaN(n) ? "" : `${item.price_currency ?? "KES"} ${n.toLocaleString()}`;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ── Check item ────────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg className="w-3.5 h-3.5 text-green-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function Circle() {
  return <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 inline-block shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateCampaign() {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pages, setPages] = useState<SocialAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ── Selections ────────────────────────────────────────────────────────────
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);  // ✅ multi-select
  const [templateId, setTemplateId] = useState("");
  const [pageId, setPageId] = useState("");

  // ── Product search filter ──────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");

  // ── Caption ───────────────────────────────────────────────────────────────
  const [caption, setCaption] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Submit ────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const selectedPage = pages.find((p) => p.page_id === pageId) ?? null;

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return (
      !q ||
      stripHtml(p.title).toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q)
    );
  });

  const canGenerate = selectedProductIds.length > 0;
  const canSubmit =
    selectedProductIds.length > 0 &&
    !!templateId &&
    !!pageId &&
    caption.trim().length > 0;

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setDataLoading(true); setDataError("");
      const [items, tRes, sRes] = await Promise.all([
        listCatalogItems(),
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

  // ── Product selection ──────────────────────────────────────────────────────
  function toggleProduct(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCaption(""); // clear stale caption when selection changes
  }

  function removeProduct(id: string) {
    setSelectedProductIds((prev) => prev.filter((x) => x !== id));
    setCaption("");
  }

  // ── AI Generate ───────────────────────────────────────────────────────────
  async function handleGenerateAI() {
    if (!canGenerate) return;
    try {
      setAiLoading(true); setCaption("");

      // ✅ Send product_ids[] — not product_id
      const payload: Record<string, unknown> = {
        product_ids: selectedProductIds,
      };
      if (templateId) payload.template_id = templateId;

      const data = await post<unknown>("/api/v1/ai/generate", payload);

      // Handle every known response shape
      let text = "";
      if (typeof data === "string") text = data;
      else if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        text = (
          (d.full_caption as string) ??
          (d.caption as string) ??
          (d.text as string) ??
          (d.content as string) ??
          (d.result as string) ??
          ""
        );
      }

      if (!text.trim()) {
        alert("AI returned an empty response. Check your template configuration.");
      } else {
        setCaption(stripHtml(text));
      }
    } catch (err: any) {
      alert(err?.message || "AI generation failed.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);

      // ✅ product_ids[] in payload
      await post("/api/v1/campaigns", {
        caption: caption.trim(),
        product_ids: selectedProductIds,                              // ✅ array
        template_id: templateId,
        page_ids: [pageId],
        platforms: [selectedPage?.platform ?? "facebook"],
        media_urls: selectedProducts.map((p) => p.image_url).filter(Boolean), // ✅ multi-image
      });

      navigate("/campaigns");
    } catch (err: any) {
      alert(err?.message || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="p-6 flex items-center gap-3 text-gray-400 text-sm">
        <Spinner /> Loading campaign data…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">POSTIKA</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Campaign</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select one or more products, pick a template and page, generate your AI caption, then publish.
        </p>
      </div>

      {/* Error */}
      {dataError && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          ⚠ {dataError}
          <button onClick={loadAll} className="underline font-bold text-xs ml-4">Retry</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ══════════════════════════════════════════════════════════
            STEP 1 — PRODUCT SELECTION (multi-select)
        ══════════════════════════════════════════════════════════ */}
        <section className="border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                1. Select Products
                <span className="text-red-500 ml-0.5">*</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Click to add or remove. Multiple allowed.</p>
            </div>
            {selectedProductIds.length > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {selectedProductIds.length} selected
              </span>
            )}
          </div>

          {/* Search within products */}
          {products.length > 6 && (
            <div className="px-4 pt-3">
              <input
                type="text"
                placeholder="Search products…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {products.length === 0 ? (
            <div className="p-6 text-center text-amber-600 text-sm bg-amber-50">
              No products in catalog. <a href="/catalog" className="underline font-semibold">Add products first →</a>
            </div>
          ) : (
            /* Scrollable product grid */
            <div className="p-4 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition w-full ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                    >
                      {/* Product image */}
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={stripHtml(product.title)}
                          className="w-12 h-12 object-cover rounded-lg border shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-xs shrink-0">
                          IMG
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                          {stripHtml(product.title)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatPrice(product)}</p>
                      </div>
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {filteredProducts.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">No products match your search.</p>
              )}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            SELECTED PRODUCTS PREVIEW GRID
        ══════════════════════════════════════════════════════════ */}
        {selectedProducts.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Selected Products Preview
            </h2>
            <div className="flex gap-3 flex-wrap">
              {selectedProducts.map((p) => (
                <div
                  key={p.id}
                  className="relative group w-28 shrink-0 border rounded-xl overflow-hidden shadow-sm bg-white"
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={stripHtml(p.title)}
                      className="w-28 h-24 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-28 h-24 bg-gray-100 flex items-center justify-center text-gray-300 text-xs">
                      No Image
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">{stripHtml(p.title)}</p>
                    <p className="text-xs text-gray-400">{formatPrice(p)}</p>
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeProduct(p.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold hidden group-hover:flex items-center justify-center shadow transition"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP 2 — TEMPLATE
        ══════════════════════════════════════════════════════════ */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            2. Template <span className="text-red-500">*</span>
          </label>
          {templates.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              No templates found. <a href="/templates" className="underline font-semibold">Create one →</a>
            </p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setCaption(""); }}
              className="w-full border rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {selectedTemplate && (
            <p className="text-xs text-gray-400 mt-1.5">
              ✓ <strong>{selectedTemplate.name}</strong> will define the AI caption tone.
            </p>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            STEP 3 — PAGE / SOCIAL ACCOUNT
        ══════════════════════════════════════════════════════════ */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            3. Page / Social Account <span className="text-red-500">*</span>
          </label>
          {pages.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              No connected pages. Connect a social account first.
            </p>
          ) : (
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a page —</option>
              {pages.map((p) => (
                <option key={p.page_id} value={p.page_id}>
                  {p.page_name || p.page_id}{p.platform ? ` (${p.platform})` : ""}
                </option>
              ))}
            </select>
          )}
          {selectedPage && (
            <p className="text-xs text-gray-400 mt-1.5">
              ✓ Posting to <strong>{selectedPage.page_name || selectedPage.page_id}</strong>
              {selectedPage.platform ? ` on ${selectedPage.platform}` : ""}
            </p>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            STEP 4 — AI CAPTION
        ══════════════════════════════════════════════════════════ */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            4. Caption <span className="text-red-500">*</span>
          </label>

          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={aiLoading || !canGenerate}
            className="w-full mb-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
          >
            {aiLoading ? <><Spinner /> Generating caption…</> : <>✨ Generate with AI{selectedProductIds.length > 1 ? ` (${selectedProductIds.length} products)` : ""}</>}
          </button>

          {!canGenerate && (
            <p className="text-xs text-gray-400 mb-2">Select at least one product to enable AI generation.</p>
          )}

          <textarea
            placeholder={
              aiLoading
                ? "Generating…"
                : "AI caption will appear here. You can also type or edit manually."
            }
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            disabled={aiLoading}
            className="w-full border rounded-xl p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Edit the generated caption freely before submitting.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            READINESS CHECKLIST
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-gray-50 border rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Ready to publish?
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              {selectedProductIds.length > 0 ? <Check /> : <Circle />}
              <span className={selectedProductIds.length > 0 ? "text-green-700 font-medium" : "text-gray-400"}>
                Products selected
                {selectedProductIds.length > 0 ? ` — ${selectedProductIds.length} product${selectedProductIds.length > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {templateId ? <Check /> : <Circle />}
              <span className={templateId ? "text-green-700 font-medium" : "text-gray-400"}>
                Template{selectedTemplate ? ` — ${selectedTemplate.name}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {pageId ? <Check /> : <Circle />}
              <span className={pageId ? "text-green-700 font-medium" : "text-gray-400"}>
                Page{selectedPage ? ` — ${selectedPage.page_name || selectedPage.page_id}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {caption.trim() ? <Check /> : <Circle />}
              <span className={caption.trim() ? "text-green-700 font-medium" : "text-gray-400"}>
                Caption ready
              </span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SUBMIT
        ══════════════════════════════════════════════════════════ */}
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
        >
          {submitting ? <><Spinner /> Creating campaign…</> : "🚀 Create Campaign"}
        </button>

      </form>
    </div>
  );
}
