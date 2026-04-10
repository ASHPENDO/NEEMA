/**
 * Catalog.tsx — POSTIKA
 *
 * Fixes applied in this version:
 *  1. stripHtml() applied to TITLES as well as descriptions (fixes "0" class=... in product names)
 *  2. Edit opens an inline modal — NO window.location.href navigation (fixes 404 /catalog/{id}/edit)
 *  3. Caption preview handles every known AI response shape + logs raw response for debugging
 *  4. Import URL uses full crawling payload (crawl_product_pages, max_product_pages, etc.)
 *  5. Pagination: 25/50/100/150, NEMIS-style page buttons with ellipsis
 *  6. Mobile-first responsive layout (card view on small screens, table on md+)
 *  7. HTML entities decoded everywhere before display/storage
 */

import { useState, useEffect, useRef, Fragment } from "react";
import {
  listCatalogItems,
  createCatalogItem,
  deleteCatalogItem,
  bulkDeleteCatalogItems,
  bulkUploadCatalogZip,
  scrapeCatalogItems,
  updateCatalogItem,
  get,
  post,
  type CatalogItem,
  type CatalogCreateRequest,
  type CatalogUpdateRequest,
} from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Remove ALL HTML tags and decode common entities */
function stripHtml(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")       // remove tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract a caption string from any shape the AI endpoint returns.
 *
 * Handles all known response shapes:
 *   "string"
 *   { full_caption }
 *   { caption }
 *   { data: { full_caption } }         <- backend wraps in { success, data }
 *   { success: true, data: { ... } }
 */
function extractCaption(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data.trim();

  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;

    // Unwrap { success: true, data: { ... } } envelope first
    if (d.data && typeof d.data === "object") {
      const inner = d.data as Record<string, unknown>;
      const innerCandidate =
        inner.full_caption ?? inner.caption ?? inner.text ??
        inner.content ?? inner.result ?? inner.output;
      if (typeof innerCandidate === "string" && innerCandidate.trim())
        return innerCandidate.trim();
    }

    // Top-level fields
    const candidate =
      d.full_caption ?? d.caption ?? d.text ?? d.content ??
      d.result ?? d.output ?? d.message;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

    // Array content blocks (Anthropic-style)
    if (Array.isArray(d.content) && d.content.length > 0) {
      const first = d.content[0];
      if (typeof first === "string") return first.trim();
      if (first && typeof first === "object" && typeof (first as any).text === "string")
        return (first as any).text.trim();
    }
  }

  // Last resort: show raw JSON so developer can see the exact shape
  try { return JSON.stringify(data, null, 2); } catch { return ""; }
}

function formatPrice(item: CatalogItem): string {
  if (item.price_amount == null) return "—";
  const n = Number(item.price_amount);
  if (isNaN(n)) return "—";
  return `${item.price_currency ?? "KES"} ${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MODAL WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] flex flex-col`}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-lg leading-none"
          >
            ✕
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPLOAD ZIP
// ─────────────────────────────────────────────────────────────────────────────

function BulkUploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) { setError("Please select a ZIP file."); return; }
    if (!file.name.toLowerCase().endsWith(".zip")) { setError("Only .zip files accepted."); return; }
    try {
      setLoading(true); setError("");
      const res = await bulkUploadCatalogZip(file);
      setResult({ created: res.created_count, errors: res.error_count });
      onSuccess();
      if (res.error_count === 0) setTimeout(onClose, 1800);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Bulk Upload ZIP" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Upload a ZIP containing product folders. Each folder should have images and optionally a{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">products.csv</code> or{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">products.json</code> manifest.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition mb-4"
      >
        {file ? (
          <>
            <p className="text-2xl mb-1">📦</p>
            <p className="font-semibold text-gray-800 text-sm">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p className="text-xs text-blue-500 mt-2">Click to change file</p>
          </>
        ) : (
          <>
            <p className="text-3xl mb-2">📦</p>
            <p className="text-gray-600 text-sm font-medium">Click to select a ZIP file</p>
            <p className="text-gray-400 text-xs mt-1">or drag and drop here</p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".zip" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(""); setResult(null); } }} />
      </div>

      {error && <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</p>}
      {result && (
        <div className={`mb-3 p-3 rounded-lg text-sm border ${result.errors > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}`}>
          ✓ Imported <strong>{result.created}</strong> products{result.errors > 0 ? ` · ${result.errors} errors` : ""}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleUpload} disabled={loading || !file}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {loading && <Spinner />}
          {loading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT URL
// ─────────────────────────────────────────────────────────────────────────────

function ImportUrlModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; mode: string } | null>(null);
  const [step, setStep] = useState("");

  async function handleImport() {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    try { new URL(trimmed); } catch { setError("Enter a valid URL including https://"); return; }

    try {
      setLoading(true); setError(""); setResult(null);

      const steps = [
        "Connecting to site…",
        "Detecting product structure…",
        "Crawling product pages…",
        "Extracting products…",
      ];
      let si = 0;
      setStep(steps[0]);
      const ticker = setInterval(() => {
        si = (si + 1) % steps.length;
        setStep(steps[si]);
      }, 1200);

      const res = await scrapeCatalogItems({
        url: trimmed,
        max_items: parseInt(maxItems) || 50,
        allow_fallback: true,
        try_shopify_product_json: true,
        try_woocommerce_store_api: true,
        crawl_product_pages: true,
        max_product_pages: 40,
        fallback_price_amount: null,
        fallback_price_currency: null,
      });

      clearInterval(ticker);
      setStep("");

      const created = res.created?.length ?? 0;
      setResult({ created, skipped: res.skipped ?? 0, mode: res.mode_used ?? "generic" });

      if (created > 0) {
        onSuccess();
        setTimeout(onClose, 2200);
      }
    } catch (err: any) {
      setStep("");
      const msg: string = err?.message || "Import failed.";
      if (msg.toLowerCase().includes("block") || msg.includes("403"))
        setError("This site blocks scrapers. Try a direct product page URL, or use Bulk Upload ZIP instead.");
      else if (msg.includes("404"))
        setError("URL not found (404). Double-check the address.");
      else
        setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Import from URL" onClose={onClose} wide>
      <p className="text-sm text-gray-500 mb-1">
        Paste any product listing or product page URL. We'll automatically detect the
        site structure and import products with their prices and images.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-4">
        ⚠ Some sites require JavaScript to display products and cannot be scraped directly.
        If import returns 0 products, try pasting a direct product page URL or use{" "}
        <strong>Bulk Upload ZIP</strong> instead.
      </div>

      <div className="space-y-3 mb-4">
        <input
          type="url"
          placeholder="https://www.phoneplacekenya.com/product-category/smartphones/motorola-phones/"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleImport()}
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Max products:</label>
          <select value={maxItems} onChange={(e) => setMaxItems(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
            {["10", "25", "50", "100"].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {loading && step && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-3">
          <Spinner className="text-blue-500" /> {step}
        </div>
      )}
      {error && (
        <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">{error}</div>
      )}
      {result && (
        <div className={`mb-3 p-3 rounded-lg text-sm border ${result.created > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          {result.created > 0
            ? <>✓ Imported <strong>{result.created}</strong> products{result.skipped > 0 ? ` (${result.skipped} skipped)` : ""} via <em>{result.mode}</em></>
            : <>⚠ Connected but found <strong>0 products</strong>. The page may require JavaScript. Try a direct product URL or ZIP upload.</>}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleImport} disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {loading && <Spinner />}
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PRODUCT
// ─────────────────────────────────────────────────────────────────────────────

function AddProductModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", sku: "",
    price_amount: "", price_currency: "KES", image_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setError("");
  }

  async function handleAdd() {
    if (!form.title.trim()) { setError("Product title is required."); return; }
    if (!form.price_amount) { setError("Price is required."); return; }
    try {
      setLoading(true);
      await createCatalogItem({
        title: form.title.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        price_amount: parseFloat(form.price_amount),
        price_currency: form.price_currency || "KES",
        image_url: form.image_url.trim() || null,
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to add product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Product" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Title *">
          <input placeholder="Samsung Galaxy S24" value={form.title} autoFocus
            onChange={(e) => set("title", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea placeholder="256GB, excellent condition…" value={form.description} rows={3}
            onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-y`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input placeholder="SKU-001" value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Price *">
            <div className="flex gap-1">
              <select value={form.price_currency} onChange={(e) => set("price_currency", e.target.value)}
                className="border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none w-20 shrink-0">
                {["KES","USD","UGX","TZS"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="205000" value={form.price_amount}
                onChange={(e) => set("price_amount", e.target.value)} className={inputCls} />
            </div>
          </Field>
        </div>
        <Field label="Image URL">
          <input type="url" placeholder="https://…/image.jpg" value={form.image_url}
            onChange={(e) => set("image_url", e.target.value)} className={inputCls} />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className={cancelBtn}>Cancel</button>
          <button onClick={handleAdd} disabled={loading} className={primaryBtn}>
            {loading && <Spinner />}{loading ? "Adding…" : "Add Product"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT PRODUCT — opens as modal, NO page navigation
// ─────────────────────────────────────────────────────────────────────────────

function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: CatalogItem;
  onClose: () => void;
  onSaved: (updated: CatalogItem) => void;
}) {
  const [form, setForm] = useState({
    title: stripHtml(product.title) ?? "",
    description: stripHtml(product.description) ?? "",
    sku: product.sku ?? "",
    price_amount: product.price_amount?.toString() ?? "",
    price_currency: product.price_currency ?? "KES",
    image_url: product.image_url ?? "",
    status: product.status ?? "active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setError("");
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    try {
      setLoading(true);
      const payload: CatalogUpdateRequest = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        price_amount: parseFloat(form.price_amount) || 0,
        price_currency: form.price_currency || "KES",
        image_url: form.image_url.trim() || null,
        status: form.status,
      };
      const updated = await updateCatalogItem(product.id, payload);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Edit Product" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Image preview */}
        {form.image_url && (
          <div className="flex justify-center">
            <img src={form.image_url} alt={form.title}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              className="w-28 h-28 object-cover rounded-xl border shadow" />
          </div>
        )}

        <Field label="Title *">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus className={inputCls} />
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            rows={4} className={`${inputCls} resize-y`} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </Field>
        </div>

        <Field label="Price">
          <div className="flex gap-2">
            <select value={form.price_currency} onChange={(e) => set("price_currency", e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none w-20 shrink-0">
              {["KES","USD","UGX","TZS"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" value={form.price_amount}
              onChange={(e) => set("price_amount", e.target.value)} className={inputCls} />
          </div>
        </Field>

        <Field label="Image URL">
          <input type="url" value={form.image_url}
            onChange={(e) => set("image_url", e.target.value)} className={inputCls} />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-2 justify-end pt-3 border-t mt-2">
          <button onClick={onClose} className={cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={loading} className={primaryBtn}>
            {loading && <Spinner />}{loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTION PREVIEW PANEL (inline expansion row)
// ─────────────────────────────────────────────────────────────────────────────

function CaptionPreviewPanel({
  product,
  templates,
  onClose,
}: {
  product: CatalogItem;
  templates: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const hasGenerated = caption.length > 0 || error.length > 0;

  async function generate() {
    if (!templateId) { setError("Select a template first."); return; }
    setLoading(true); setCaption(""); setError("");
    try {
      const payload: Record<string, string> = { product_id: product.id };
      if (templateId) payload.template_id = templateId;

      // post<T>() returns T directly — no .data wrapper
      const raw = await post<unknown>("/api/v1/ai/generate", payload);
      console.debug("[CaptionPreview] raw response:", raw); // helps debug shape

      const text = extractCaption(raw);
      if (!text) {
        setError("The AI returned an empty response. Check the template configuration.");
      } else {
        setCaption(stripHtml(text));
      }
    } catch (err: any) {
      setError(err?.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed — select text manually.");
    }
  }

  return (
    <tr className="bg-gradient-to-br from-indigo-50 to-blue-50 border-b">
      <td className="hidden md:table-cell" />
      <td colSpan={6} className="px-4 py-5">
        <div className="max-w-2xl">
          {/* Row header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              ✨ Caption Preview
              <span className="ml-2 font-normal text-gray-500 normal-case">— {stripHtml(product.title)}</span>
            </span>
            <button
              onClick={onClose}
              className="text-xs border border-gray-300 text-gray-500 hover:text-gray-800 hover:border-gray-400 px-3 py-1 rounded-full transition"
            >
              ✕ Close
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Template:</label>
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setCaption(""); setError(""); }}
              className="border rounded-lg px-3 py-1.5 text-xs flex-1 min-w-[140px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {templates.length === 0
                ? <option value="">No templates — create one first</option>
                : templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button
              onClick={generate}
              disabled={loading || templates.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              {loading && <Spinner />}
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Caption output */}
          {caption && (
            <div className="space-y-2">
              <div className="bg-white border border-indigo-100 rounded-xl p-4 text-sm whitespace-pre-wrap text-gray-800 shadow-sm leading-relaxed">
                {caption}
              </div>
              <button
                onClick={copy}
                className={`text-xs px-4 py-1.5 rounded-lg font-semibold transition ${copied ? "bg-green-600 text-white" : "bg-gray-900 hover:bg-gray-700 text-white"}`}
              >
                {copied ? "✓ Copied!" : "Copy Caption"}
              </button>
            </div>
          )}

          {/* Idle */}
          {!hasGenerated && !loading && (
            <p className="text-xs text-gray-400 italic">
              Choose a template and click <strong>Generate</strong> to create an AI caption.
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const primaryBtn =
  "px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition";
const cancelBtn =
  "px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {children}
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-3.5 w-3.5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === "active"
      ? "bg-green-100 text-green-700"
      : s === "draft"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CATALOG PAGE
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100, 150];

export default function Catalog() {
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Caption preview — only one open at a time
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);

  // Edit modal
  const [editingProduct, setEditingProduct] = useState<CatalogItem | null>(null);

  // Ingestion modals
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Derived (declared before handlers that use them) ───────────────────────
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      stripHtml(p.title).toLowerCase().includes(q) ||
      stripHtml(p.description).toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const allOnPageSelected = paginated.length > 0 && paginated.every((p) => selected.has(p.id));
  const someOnPageSelected = paginated.some((p) => selected.has(p.id)) && !allOnPageSelected;

  useEffect(() => { setPage(1); }, [search, pageSize]);

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setDataLoading(true); setLoadError("");
      const [items, tRes] = await Promise.all([
        listCatalogItems(),
        get<{ id: string; name: string }[]>("/api/v1/templates/"),
      ]);
      setProducts(Array.isArray(items) ? items : []);
      setTemplates(Array.isArray(tRes) ? tRes : []);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load catalog.");
    } finally {
      setDataLoading(false);
    }
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;
    try {
      setBulkDeleting(true);
      await bulkDeleteCatalogItems([...selected]);
      setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch { alert("Some deletions failed. Refresh and try again."); }
    finally { setBulkDeleting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteCatalogItem(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (openPreviewId === id) setOpenPreviewId(null);
    } catch (err: any) { alert(err?.message || "Delete failed."); }
  }

  // ─── Pagination bar ────────────────────────────────────────────────────────

  function PaginationBar() {
    if (filtered.length <= pageSize && totalPages <= 1) return null;

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

    const btnBase = "px-3 py-1.5 rounded-lg border text-xs font-medium transition";
    const btnActive = `${btnBase} bg-gray-900 text-white border-gray-900`;
    const btnIdle = `${btnBase} text-gray-600 hover:bg-gray-100`;
    const btnDisabled = `${btnBase} text-gray-300 cursor-not-allowed`;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Show</span>
          <select value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none">
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>per page · <strong>{filtered.length}</strong> total</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setPage(1)} disabled={safePage === 1}
            className={safePage === 1 ? btnDisabled : btnIdle}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
            className={safePage === 1 ? btnDisabled : btnIdle}>‹</button>

          {makeRange().map((r, i) =>
            r === "…"
              ? <span key={`e${i}`} className="px-1.5 text-gray-400 text-xs select-none">…</span>
              : <button key={r} onClick={() => setPage(r as number)}
                  className={safePage === r ? btnActive : btnIdle}>{r}</button>
          )}

          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className={safePage === totalPages ? btnDisabled : btnIdle}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
            className={safePage === totalPages ? btnDisabled : btnIdle}>»</button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">

      {/* ── MODALS ── */}
      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} onSuccess={loadData} />}
      {showImportUrl && <ImportUrlModal onClose={() => setShowImportUrl(false)} onSuccess={loadData} />}
      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} onSuccess={loadData} />}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditingProduct(null);
          }}
        />
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">POSTIKA</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">Catalog</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage tenant products.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowBulkUpload(true)}
            className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap">
            📦 Bulk Upload ZIP
          </button>
          <button onClick={() => setShowImportUrl(true)}
            className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap">
            🌐 Import URL
          </button>
          <button onClick={() => setShowAddProduct(true)}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap">
            + Add Product
          </button>
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {loadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          ⚠ {loadError}
          <button onClick={loadData} className="underline text-xs font-bold ml-4">Retry</button>
        </div>
      )}

      {/* ── SEARCH + BULK DELETE ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="text" placeholder="Search products…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap flex items-center gap-2 transition">
            {bulkDeleting && <Spinner />}
            🗑 Delete {selected.size} selected
          </button>
        )}
      </div>

      {/* ── LOADING ── */}
      {dataLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-3 text-sm">
          <Spinner className="h-5 w-5" /> Loading catalog…
        </div>
      )}

      {/* ── TABLE / CARDS ── */}
      {!dataLoading && (
        <>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">

            {/* ── MOBILE CARDS (< md) ── */}
            <div className="md:hidden divide-y">
              {paginated.length === 0 && (
                <div className="p-10 text-center text-gray-400 text-sm">
                  {products.length === 0 ? "No products yet — add some above." : "No products match your search."}
                </div>
              )}
              {paginated.map((product) => {
                const isChecked = selected.has(product.id);
                const isOpen = openPreviewId === product.id;
                return (
                  <div key={product.id} className={`p-4 ${isChecked ? "bg-red-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isChecked}
                        onChange={() => toggleSelect(product.id)}
                        className="accent-red-500 mt-1 cursor-pointer shrink-0" />
                      {product.image_url
                        ? <img src={product.image_url} alt={stripHtml(product.title)}
                            className="w-16 h-16 rounded-xl object-cover border shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-xs shrink-0">IMG</div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{stripHtml(product.title)}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{stripHtml(product.description)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-800">{formatPrice(product)}</span>
                          <StatusBadge status={product.status} />
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <button onClick={() => setOpenPreviewId(isOpen ? null : product.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${isOpen ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"}`}>
                            {isOpen ? "Hide" : "✨ Caption"}
                          </button>
                          <button onClick={() => setEditingProduct(product)}
                            className="text-xs border border-gray-300 text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition font-medium">Edit</button>
                          <button onClick={() => handleDelete(product.id)}
                            className="text-xs border border-red-300 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition font-medium">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP TABLE (md+) ── */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = someOnPageSelected; }}
                      onChange={toggleSelectAll} className="accent-red-500 cursor-pointer" />
                  </th>
                  <th className="p-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="p-3 text-left font-semibold text-gray-700 hidden lg:table-cell">SKU</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Price</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                      {products.length === 0 ? "No products yet — use the buttons above to add some." : "No products match your search."}
                    </td>
                  </tr>
                )}

                {paginated.map((product) => {
                  const isChecked = selected.has(product.id);
                  const isOpen = openPreviewId === product.id;
                  const cleanTitle = stripHtml(product.title);
                  const cleanDesc = stripHtml(product.description);

                  return (
                    <Fragment key={product.id}>
                      <tr className={`border-b transition-colors ${isChecked ? "bg-red-50" : "hover:bg-gray-50/70"}`}>
                        {/* Checkbox */}
                        <td className="p-3">
                          <input type="checkbox" checked={isChecked}
                            onChange={() => toggleSelect(product.id)}
                            className="accent-red-500 cursor-pointer" />
                        </td>

                        {/* Product */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {product.image_url
                              ? <img src={product.image_url} alt={cleanTitle}
                                  className="w-12 h-12 rounded-xl object-cover border shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-xs shrink-0">IMG</div>}
                            <div className="min-w-0">
                              {/* ✅ cleanTitle — stripHtml applied to title field */}
                              <p className="font-semibold text-gray-900 truncate max-w-[240px] leading-snug">{cleanTitle}</p>
                              <p className="text-xs text-gray-400 line-clamp-1 max-w-[260px] mt-0.5">{cleanDesc}</p>
                            </div>
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="p-3 text-gray-500 text-xs hidden lg:table-cell">{product.sku || "—"}</td>

                        {/* Price */}
                        <td className="p-3 font-semibold text-gray-900">{formatPrice(product)}</td>

                        {/* Status */}
                        <td className="p-3"><StatusBadge status={product.status} /></td>

                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setOpenPreviewId(isOpen ? null : product.id)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${isOpen ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"}`}>
                              {isOpen ? "Hide" : "✨ Caption"}
                            </button>
                            {/* ✅ Edit opens modal — NOT window.location.href */}
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="text-xs border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium">
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-xs border border-red-300 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition font-medium">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ✅ Caption preview — toggles on/off, explicit close button */}
                      {isOpen && (
                        <CaptionPreviewPanel
                          product={product}
                          templates={templates}
                          onClose={() => setOpenPreviewId(null)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          <PaginationBar />

          {/* ── FOOTER ── */}
          <p className="text-xs text-gray-400 mt-2">
            Showing {paginated.length > 0 ? `${pageStart + 1}–${pageStart + paginated.length}` : "0"} of{" "}
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            {selected.size > 0 ? ` · ${selected.size} selected` : ""}
          </p>
        </>
      )}
    </div>
  );
}
