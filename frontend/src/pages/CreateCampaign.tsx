/**
 * CreateCampaign.tsx — POSTIKA
 * Multi-product campaign creation with AI editor + partial regeneration.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listCatalogItems, get, post, type CatalogItem } from "../lib/api";
import { templates as localTemplates } from "../lib/templates";
import AIResultEditor from "../components/AIResultEditor";
import { formatPrice, formatPricePsychology } from "../utils/format";

interface Template {
  id: string;
  name: string;
}

interface SocialAccount {
  page_id: string;
  page_name?: string;
  platform?: string;
}

type AIResult = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  full_caption: string;
};

const S: Record<string, React.CSSProperties> = {
  btnDark:          { backgroundColor: "#111827", color: "#ffffff", border: "none" },
  btnDarkDisabled:  { backgroundColor: "#d1d5db", color: "#ffffff", border: "none", cursor: "not-allowed" },
  btnIndigo:        { backgroundColor: "#4f46e5", color: "#ffffff", border: "none" },
  btnIndigoDisabled:{ backgroundColor: "#a5b4fc", color: "#ffffff", border: "none", cursor: "not-allowed" },
  btnOutline:       { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db" },
  btnRedSmall:      { backgroundColor: "#ef4444", color: "#ffffff", border: "none" },
};

function stripHtml(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim();
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

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

export default function CreateCampaign() {
  const navigate = useNavigate();

  const [products,    setProducts]    = useState<CatalogItem[]>([]);
  const [templates,   setTemplates]   = useState<Template[]>([]);
  const [pages,       setPages]       = useState<SocialAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError,   setDataError]   = useState("");

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [templateId,         setTemplateId]         = useState("");
  const [pageId,             setPageId]             = useState("");
  const [productSearch,      setProductSearch]      = useState("");

  const [aiResult,     setAiResult]     = useState<AIResult | null>(null);
  const [finalCaption, setFinalCaption] = useState("");
  const [aiLoading,    setAiLoading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const selectedPage     = pages.find((p) => p.page_id === pageId) ?? null;

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return !q || stripHtml(p.title).toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
  });

  const previewPrice = selectedProducts[0]
    ? formatPricePsychology(
        Number(selectedProducts[0].price_amount),
        selectedProducts[0].price_currency ?? "KES",
        "starting"
      )
    : "";

  const canGenerate = selectedProductIds.length > 0;
  const canSubmit   = selectedProductIds.length > 0 && !!templateId && !!pageId && finalCaption.trim().length > 0;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setDataLoading(true);
      setDataError("");

      // Load products and pages in parallel
      // Templates: try backend first, fall back to local templates
      const [items, sRes] = await Promise.all([
        listCatalogItems(),
        get<SocialAccount[]>("/api/v1/social-accounts/").catch(() => [] as SocialAccount[]),
      ]);

      setProducts(Array.isArray(items) ? items : []);
      setPages(Array.isArray(sRes) ? sRes : []);

      // Templates: backend first, local fallback
      try {
        const tRes = await get<Template[]>("/api/v1/templates/");
        const backendTemplates = Array.isArray(tRes) && tRes.length > 0 ? tRes : [];
        if (backendTemplates.length > 0) {
          setTemplates(backendTemplates);
        } else {
          // Use local templates — map to same shape
          setTemplates(localTemplates.map((t) => ({ id: t.id, name: t.name })));
        }
      } catch {
        // Backend templates unavailable — use local
        setTemplates(localTemplates.map((t) => ({ id: t.id, name: t.name })));
      }

    } catch (err: any) {
      setDataError(err?.message || "Failed to load data. Please refresh.");
    } finally {
      setDataLoading(false);
    }
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setAiResult(null);
    setFinalCaption("");
  }

  function removeProduct(id: string) {
    setSelectedProductIds((prev) => prev.filter((x) => x !== id));
    setAiResult(null);
    setFinalCaption("");
  }

  async function handleGenerateAI() {
    if (!canGenerate) return;
    try {
      setAiLoading(true);
      setAiResult(null);
      setFinalCaption("");

      // If using a local template, generate caption locally without hitting backend
      const localTemplate = localTemplates.find((t) => t.id === templateId);
      if (localTemplate && selectedProducts.length > 0) {
        const generated = localTemplate.generate(selectedProducts[0], selectedProducts);
        const result: AIResult = {
          hook: "",
          body: generated.caption,
          cta: "",
          hashtags: [],
          full_caption: generated.caption,
        };
        setAiResult(result);
        setFinalCaption(result.full_caption);
        return;
      }

      // Backend AI generation
      const payload: Record<string, unknown> = { product_ids: selectedProductIds };
      if (templateId) payload.template_id = templateId;

      const data = await post<unknown>("/api/v1/ai/generate", payload);

      let result: AIResult;

      const unwrappedPayload: unknown =
        (data && typeof data === "object" && (data as any).data)
          ? (data as any).data
          : data;

      if (unwrappedPayload && typeof unwrappedPayload === "object") {
        const d = unwrappedPayload as Record<string, unknown>;
        const hook        = (d.hook as string) ?? "";
        const body        = (d.body as string) ?? "";
        const cta         = (d.cta  as string) ?? "";
        const hashtagsRaw = d.hashtags;
        const hashtags: string[] = Array.isArray(hashtagsRaw)
          ? hashtagsRaw.map(String)
          : typeof hashtagsRaw === "string"
          ? hashtagsRaw.split(" ").filter(Boolean)
          : [];
        const full_caption =
          (d.full_caption as string) ??
          (d.caption      as string) ??
          (d.text         as string) ??
          [hook, body, cta, hashtags.join(" ")].filter(Boolean).join("\n\n") ??
          "";
        result = { hook, body, cta, hashtags, full_caption };
      } else if (typeof data === "string") {
        result = { hook: "", body: "", cta: "", hashtags: [], full_caption: data };
      } else {
        alert("AI returned an unexpected response. Check the browser console.");
        console.error("[AI] Unexpected shape:", data);
        return;
      }

      setAiResult(result);
      setFinalCaption(result.full_caption);
    } catch (err: any) {
      alert(err?.message || "AI generation failed.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await post("/api/v1/campaigns", {
        caption:     finalCaption.trim(),
        product_ids: selectedProductIds,
        template_id: templateId,
        page_ids:    [pageId],
        platforms:   [selectedPage?.platform ?? "facebook"],
        media_urls:  selectedProducts.map((p) => p.image_url).filter(Boolean),
      });
      navigate("/campaigns");
    } catch (err: any) {
      alert(err?.message || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="p-6 flex items-center gap-3 text-gray-400 text-sm">
        <Spinner /> Loading campaign data…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      <div className="mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">POSTIKA</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Campaign</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select products, pick a template and page, generate and refine your AI caption, then publish.
        </p>
      </div>

      {dataError && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          ⚠ {dataError}
          <button onClick={loadAll} style={S.btnOutline} className="underline font-bold text-xs ml-4 px-2 py-1 rounded">
            Retry
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* STEP 1 — SELECT PRODUCTS */}
        <section className="border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                1. Select Products <span className="text-red-500">*</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Click to add or remove. Multiple allowed.</p>
            </div>
            {selectedProductIds.length > 0 && (
              <span style={{ backgroundColor: "#2563eb", color: "#fff" }} className="text-xs font-bold px-2.5 py-1 rounded-full">
                {selectedProductIds.length} selected
              </span>
            )}
          </div>

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
              No products in catalog.{" "}
              <a href="/catalog" className="underline font-semibold">Add products first →</a>
            </div>
          ) : (
            <div className="p-4 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      style={isSelected
                        ? { borderColor: "#3b82f6", backgroundColor: "#eff6ff" }
                        : { borderColor: "#e5e7eb", backgroundColor: "#ffffff" }
                      }
                      className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition w-full"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={stripHtml(product.title)}
                          className="w-12 h-12 object-cover rounded-lg border shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-xs shrink-0">IMG</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: isSelected ? "#1e40af" : "#1f2937" }}>
                          {stripHtml(product.title)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatPrice(Number(product.price_amount), product.price_currency ?? "KES")}
                        </p>
                      </div>
                      {isSelected && (
                        <div style={{ backgroundColor: "#2563eb" }} className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
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

        {/* SELECTED PRODUCTS PREVIEW */}
        {selectedProducts.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Selected Products Preview</h2>
            {previewPrice && (
              <div className="text-sm font-medium mb-2" style={{ color: "#4f46e5" }}>{previewPrice}</div>
            )}
            <div className="flex gap-3 flex-wrap">
              {selectedProducts.map((p) => (
                <div key={p.id} className="relative group w-28 shrink-0 border rounded-xl overflow-hidden shadow-sm bg-white">
                  {p.image_url ? (
                    <img src={p.image_url} alt={stripHtml(p.title)} className="w-28 h-24 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-28 h-24 bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No Image</div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">{stripHtml(p.title)}</p>
                    <p className="text-xs text-gray-400">{formatPrice(Number(p.price_amount), p.price_currency ?? "KES")}</p>
                  </div>
                  <button type="button" onClick={() => removeProduct(p.id)} style={S.btnRedSmall}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full text-xs font-bold hidden group-hover:flex items-center justify-center shadow transition"
                    title="Remove">✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <span className="text-base mt-0.5 shrink-0">ℹ️</span>
              <p className="text-xs leading-relaxed" style={{ color: "#3730a3" }}>
                <strong>Product descriptions, pricing, location, and contact details</strong> are
                automatically injected into the AI caption. Just click <strong>Generate</strong> below.
              </p>
            </div>
          </section>
        )}

        {/* STEP 2 — TEMPLATE */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            2. Template <span className="text-red-500">*</span>
          </label>
          {templates.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              No templates available.
            </p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setAiResult(null); setFinalCaption(""); }}
              className="w-full border rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {selectedTemplate && (
            <p className="text-xs text-gray-400 mt-1.5">
              ✓ <strong>{selectedTemplate.name}</strong> will define the AI caption tone.
            </p>
          )}
        </section>

        {/* STEP 3 — PAGE */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            3. Page / Social Account <span className="text-red-500">*</span>
          </label>
          {pages.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              No connected pages. Connect a social account first.
            </p>
          ) : (
            <select value={pageId} onChange={(e) => setPageId(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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

        {/* STEP 4 — AI CAPTION */}
        <section>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            4. AI Caption <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={aiLoading || !canGenerate}
              style={aiLoading || !canGenerate ? S.btnIndigoDisabled : S.btnIndigo}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
            >
              {aiLoading
                ? <><Spinner /> Generating caption…</>
                : <>✨ Generate AI Caption{selectedProductIds.length > 0 ? ` — auto-includes details` : ""}{selectedProductIds.length > 1 ? ` (${selectedProductIds.length} products)` : ""}</>}
            </button>
            {aiResult && (
              <button type="button" onClick={() => { setAiResult(null); setFinalCaption(""); }}
                style={S.btnOutline} className="px-4 py-3 rounded-xl text-sm font-semibold transition">
                Reset
              </button>
            )}
          </div>
          {!canGenerate && (
            <p className="text-xs text-gray-400 mb-2">Select at least one product to enable AI generation.</p>
          )}
          {aiResult ? (
            <AIResultEditor
              result={aiResult}
              productId={selectedProductIds[0]}
              productIds={selectedProductIds}
              onChange={(updated) => { setAiResult(updated); setFinalCaption(updated.full_caption); }}
            />
          ) : (
            <textarea
              placeholder="AI caption will appear here after generation. You can also type manually."
              value={finalCaption}
              onChange={(e) => setFinalCaption(e.target.value)}
              rows={6}
              className="w-full border rounded-xl p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          )}
        </section>

        {/* READINESS CHECKLIST */}
        <section className="bg-gray-50 border rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ready to publish?</p>
          <div className="space-y-2">
            {[
              { done: selectedProductIds.length > 0, label: `Products${selectedProductIds.length > 0 ? ` — ${selectedProductIds.length} selected` : ""}` },
              { done: !!templateId, label: `Template${selectedTemplate ? ` — ${selectedTemplate.name}` : ""}` },
              { done: !!pageId, label: `Page${selectedPage ? ` — ${selectedPage.page_name || selectedPage.page_id}` : ""}` },
              { done: finalCaption.trim().length > 0, label: "Caption ready" },
            ].map(({ done, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                {done ? <Check /> : <Circle />}
                <span style={{ color: done ? "#15803d" : "#9ca3af", fontWeight: done ? 500 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          style={submitting || !canSubmit ? S.btnDarkDisabled : S.btnDark}
          className="w-full px-4 py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
        >
          {submitting ? <><Spinner /> Creating campaign…</> : "🚀 Create Campaign"}
        </button>

      </form>
    </div>
  );
}