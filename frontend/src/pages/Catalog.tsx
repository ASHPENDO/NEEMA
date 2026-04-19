/**
 * Catalog.tsx — POSTIKA
 *
 * Fixes in this version:
 *  1. Bulk selection checkboxes use inline styles (accent color guaranteed)
 *  2. SKU column always visible (removed lg:table-cell hiding)
 *  3. Description displays with inline overflow style (no line-clamp Tailwind dependency)
 *  4. PaginationBar moved outside main component to prevent remount on every render
 *  5. JS warning banner removed from ImportUrlModal
 *  6. URL placeholder updated to postika.co.ke
 *  7. All action buttons use inline styles (Tailwind v4 safe)
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

function stripHtml(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
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

function extractCaption(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (d.data && typeof d.data === "object") {
      const inner = d.data as Record<string, unknown>;
      const innerCandidate =
        inner.full_caption ?? inner.caption ?? inner.text ??
        inner.content ?? inner.result ?? inner.output;
      if (typeof innerCandidate === "string" && innerCandidate.trim())
        return innerCandidate.trim();
    }
    const candidate =
      d.full_caption ?? d.caption ?? d.text ?? d.content ??
      d.result ?? d.output ?? d.message;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Array.isArray(d.content) && d.content.length > 0) {
      const first = d.content[0];
      if (typeof first === "string") return first.trim();
      if (first && typeof first === "object" && typeof (first as any).text === "string")
        return (first as any).text.trim();
    }
  }
  try { return JSON.stringify(data, null, 2); } catch { return ""; }
}

function formatPrice(item: CatalogItem): string {
  if (item.price_amount == null) return "—";
  const n = Number(item.price_amount);
  if (isNaN(n)) return "—";
  return `${item.price_currency ?? "KES"} ${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  btnDark:         { backgroundColor: "#1f2937", color: "#ffffff", border: "none" },
  btnBlue:         { backgroundColor: "#2563eb", color: "#ffffff", border: "none" },
  btnRed:          { backgroundColor: "#dc2626", color: "#ffffff", border: "none" },
  btnIndigo:       { backgroundColor: "#4f46e5", color: "#ffffff", border: "none" },
  btnIndigoOutline:{ backgroundColor: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" },
  btnOutline:      { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db" },
  btnDeleteOutline:{ backgroundColor: "#ffffff", color: "#dc2626", border: "1px solid #fca5a5" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MODAL WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, wide = false, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "1rem", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", width: "100%", maxWidth: wide ? "42rem" : "28rem", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ ...S.btnOutline, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem" }}>{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPLOAD ZIP
// ─────────────────────────────────────────────────────────────────────────────

function BulkUploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
    } finally { setLoading(false); }
  }

  return (
    <Modal title="Bulk Upload ZIP" onClose={onClose}>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
        Upload a ZIP containing product folders. Each folder must contain a{" "}
        <code style={{ backgroundColor: "#f3f4f6", padding: "0 4px", borderRadius: 4, fontSize: "0.75rem" }}>details.json</code>{" "}
        with <code style={{ backgroundColor: "#f3f4f6", padding: "0 4px", borderRadius: 4, fontSize: "0.75rem" }}>name</code> and{" "}
        <code style={{ backgroundColor: "#f3f4f6", padding: "0 4px", borderRadius: 4, fontSize: "0.75rem" }}>price</code> fields,
        plus optional image files.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        style={{ border: "2px dashed #d1d5db", borderRadius: "0.75rem", padding: "2rem", textAlign: "center", cursor: "pointer", marginBottom: "1rem", transition: "border-color 0.2s" }}
      >
        {file ? (
          <>
            <p style={{ fontSize: "1.5rem", marginBottom: 4 }}>📦</p>
            <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>{file.name}</p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p style={{ fontSize: "0.75rem", color: "#3b82f6", marginTop: 8 }}>Click to change file</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: "2rem", marginBottom: 8 }}>📦</p>
            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Click to select a ZIP file</p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>or drag and drop here</p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".zip" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(""); setResult(null); } }} />
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "0.75rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "0.75rem", borderRadius: "0.5rem" }}>{error}</p>}
      {result && (
        <div style={{ marginBottom: "0.75rem", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", ...(result.errors > 0 ? { backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" } : { backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }) }}>
          ✓ Imported <strong>{result.created}</strong> products{result.errors > 0 ? ` · ${result.errors} errors` : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...S.btnOutline, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleUpload} disabled={loading || !file}
          style={{ ...S.btnDark, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: loading || !file ? "not-allowed" : "pointer", opacity: loading || !file ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {loading && <Spinner />}{loading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT URL
// ─────────────────────────────────────────────────────────────────────────────

function ImportUrlModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      const steps = ["Connecting to site…", "Detecting product structure…", "Crawling product pages…", "Extracting products…"];
      let si = 0;
      setStep(steps[0]);
      const ticker = setInterval(() => { si = (si + 1) % steps.length; setStep(steps[si]); }, 1200);
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
      clearInterval(ticker); setStep("");
      const created = res.created?.length ?? 0;
      setResult({ created, skipped: res.skipped ?? 0, mode: res.mode_used ?? "generic" });
      if (created > 0) { onSuccess(); setTimeout(onClose, 2200); }
    } catch (err: any) {
      setStep("");
      const msg: string = err?.message || "Import failed.";
      if (msg.toLowerCase().includes("block") || msg.includes("403"))
        setError("This site blocks scrapers. Try a direct product page URL, or use Bulk Upload ZIP instead.");
      else if (msg.includes("404")) setError("URL not found (404). Double-check the address.");
      else setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <Modal title="Import from URL" onClose={onClose} wide>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
        Paste any product listing or product page URL. POSTIKA will automatically detect the site structure and import products.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
        <input
          type="url"
          placeholder="https://www.postika.co.ke/products/"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleImport()}
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
          autoFocus
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>Max products:</label>
          <select value={maxItems} onChange={(e) => setMaxItems(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.875rem", backgroundColor: "#fff" }}>
            {["10", "25", "50", "100"].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {loading && step && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "#2563eb", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>
          <Spinner /> {step}
        </div>
      )}
      {error && (
        <div style={{ color: "#b91c1c", fontSize: "0.875rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>{error}</div>
      )}
      {result && (
        <div style={{ marginBottom: "0.75rem", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", ...(result.created > 0 ? { backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" } : { backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" }) }}>
          {result.created > 0
            ? <>✓ Imported <strong>{result.created}</strong> products{result.skipped > 0 ? ` (${result.skipped} skipped)` : ""} via <em>{result.mode}</em></>
            : <>⚠ Connected but found <strong>0 products</strong>. Try a direct product page URL or use Bulk Upload ZIP.</>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...S.btnOutline, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleImport} disabled={loading || !url.trim()}
          style={{ ...S.btnDark, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: loading || !url.trim() ? "not-allowed" : "pointer", opacity: loading || !url.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {loading && <Spinner />}{loading ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PRODUCT
// ─────────────────────────────────────────────────────────────────────────────

function AddProductModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", sku: "",
    price_amount: "", price_currency: "KES", image_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) { setForm((p) => ({ ...p, [field]: value })); setError(""); }

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
    } finally { setLoading(false); }
  }

  return (
    <Modal title="Add Product" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Field label="Title *">
          <input placeholder="Samsung Galaxy S24" value={form.title} autoFocus
            onChange={(e) => set("title", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Description">
          <textarea placeholder="256GB, excellent condition…" value={form.description} rows={3}
            onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field label="SKU">
            <input placeholder="SKU-001" value={form.sku} onChange={(e) => set("sku", e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Price *">
            <div style={{ display: "flex", gap: 4 }}>
              <select value={form.price_currency} onChange={(e) => set("price_currency", e.target.value)}
                style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.5rem", fontSize: "0.875rem", backgroundColor: "#fff", width: 72 }}>
                {["KES","USD","UGX","TZS"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="205000" value={form.price_amount}
                onChange={(e) => set("price_amount", e.target.value)} style={inputStyle} />
            </div>
          </Field>
        </div>
        <Field label="Image URL">
          <input type="url" placeholder="https://…/image.jpg" value={form.image_url}
            onChange={(e) => set("image_url", e.target.value)} style={inputStyle} />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8 }}>
          <button onClick={onClose} style={{ ...S.btnOutline, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleAdd} disabled={loading}
            style={{ ...S.btnBlue, padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8 }}>
            {loading && <Spinner />}{loading ? "Adding…" : "Add Product"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT PRODUCT
// ─────────────────────────────────────────────────────────────────────────────

function EditProductModal({ product, onClose, onSaved }: {
  product: CatalogItem; onClose: () => void; onSaved: (updated: CatalogItem) => void;
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

  function set(field: string, value: string) { setForm((p) => ({ ...p, [field]: value })); setError(""); }

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
      onSaved(updated); onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save.");
    } finally { setLoading(false); }
  }

  return (
    <Modal title="Edit Product" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {form.image_url && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img src={form.image_url} alt={form.title}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 112, height: 112, objectFit: "cover", borderRadius: "0.75rem", border: "1px solid #e5e7eb" }} />
          </div>
        )}
        <Field label="Title *">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus style={inputStyle} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </Field>
        </div>
        <Field label="Price">
          <div style={{ display: "flex", gap: 8 }}>
            <select value={form.price_currency} onChange={(e) => set("price_currency", e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.5rem", fontSize: "0.875rem", backgroundColor: "#fff", width: 72 }}>
              {["KES","USD","UGX","TZS"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" value={form.price_amount}
              onChange={(e) => set("price_amount", e.target.value)} style={inputStyle} />
          </div>
        </Field>
        <Field label="Image URL">
          <input type="url" value={form.image_url}
            onChange={(e) => set("image_url", e.target.value)} style={inputStyle} />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: "0.75rem", borderTop: "1px solid #e5e7eb", marginTop: 8 }}>
          <button onClick={onClose} style={{ ...S.btnOutline, padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={loading}
            style={{ ...S.btnBlue, padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8 }}>
            {loading && <Spinner />}{loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTION PREVIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────

function CaptionPreviewPanel({ product, templates, onClose }: {
  product: CatalogItem; templates: { id: string; name: string }[]; onClose: () => void;
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
      const raw = await post<unknown>("/api/v1/ai/generate", payload);
      const text = extractCaption(raw);
      if (!text) setError("The AI returned an empty response. Check the template configuration.");
      else setCaption(stripHtml(text));
    } catch (err: any) {
      setError(err?.message || "Generation failed.");
    } finally { setLoading(false); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert("Copy failed — select text manually."); }
  }

  return (
    <tr style={{ backgroundColor: "#f5f3ff", borderBottom: "1px solid #e5e7eb" }}>
      <td />
      <td colSpan={5} style={{ padding: "1.25rem 1rem" }}>
        <div style={{ maxWidth: "42rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ✨ Caption Preview
              <span style={{ marginLeft: 8, fontWeight: 400, color: "#6b7280", textTransform: "none" }}>— {stripHtml(product.title)}</span>
            </span>
            <button onClick={onClose} style={{ ...S.btnOutline, fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "999px", cursor: "pointer" }}>✕ Close</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>Template:</label>
            <select value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setCaption(""); setError(""); }}
              style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.75rem", flex: 1, minWidth: 140, backgroundColor: "#fff" }}>
              {templates.length === 0
                ? <option value="">No templates — create one first</option>
                : templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={generate} disabled={loading || templates.length === 0}
              style={{ ...S.btnIndigo, padding: "0.375rem 1rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 600, cursor: loading || templates.length === 0 ? "not-allowed" : "pointer", opacity: loading || templates.length === 0 ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {loading && <Spinner />}{loading ? "Generating…" : "Generate"}
            </button>
          </div>
          {error && <div style={{ marginBottom: "0.75rem", fontSize: "0.75rem", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>{error}</div>}
          {caption && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid #e0e7ff", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem", whiteSpace: "pre-wrap", color: "#1f2937", lineHeight: 1.6 }}>{caption}</div>
              <button onClick={copy}
                style={{ ...(copied ? { backgroundColor: "#16a34a", color: "#fff", border: "none" } : S.btnDark), fontSize: "0.75rem", padding: "0.375rem 1rem", borderRadius: "0.5rem", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                {copied ? "✓ Copied!" : "Copy Caption"}
              </button>
            </div>
          )}
          {!hasGenerated && !loading && (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic" }}>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

// Keep inputCls for any remaining className uses
const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#b91c1c", fontSize: "0.875rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
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
  const style: React.CSSProperties =
    s === "active"   ? { backgroundColor: "#dcfce7", color: "#15803d" } :
    s === "draft"    ? { backgroundColor: "#fef9c3", color: "#a16207" } :
    s === "inactive" ? { backgroundColor: "#fee2e2", color: "#991b1b" } :
                       { backgroundColor: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "center", padding: "0.125rem 0.625rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 500 }}>
      {status || "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION BAR — defined outside main component to prevent remount
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100, 150];

function PaginationBar({ filtered, pageSize, setPageSize, safePage, totalPages, setPage }: {
  filtered: CatalogItem[];
  pageSize: number;
  setPageSize: (n: number) => void;
  safePage: number;
  totalPages: number;
  setPage: (n: number) => void;
}) {
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

  const btnBase: React.CSSProperties = {
    padding: "0.375rem 0.625rem",
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginTop: "1rem", padding: "0 0.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "#6b7280" }}>
        <span>Show</span>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.125rem 0.5rem", fontSize: "0.75rem", backgroundColor: "#fff" }}>
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>per page · <strong>{filtered.length}</strong> total</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {[
          { label: "«", disabled: safePage === 1, onClick: () => setPage(1) },
          { label: "‹", disabled: safePage === 1, onClick: () => setPage(Math.max(1, safePage - 1)) },
        ].map(({ label, disabled, onClick }) => (
          <button key={label} onClick={onClick} disabled={disabled}
            style={{ ...btnBase, ...(disabled ? { color: "#d1d5db", cursor: "not-allowed" } : { color: "#374151", backgroundColor: "#fff" }) }}>
            {label}
          </button>
        ))}

        {makeRange().map((r, i) =>
          r === "…"
            ? <span key={`e${i}`} style={{ padding: "0 4px", color: "#9ca3af", fontSize: "0.75rem" }}>…</span>
            : <button key={r} onClick={() => setPage(r as number)}
                style={{ ...btnBase, ...(safePage === r ? { backgroundColor: "#1f2937", color: "#fff", borderColor: "#1f2937" } : { color: "#374151", backgroundColor: "#fff" }) }}>
                {r}
              </button>
        )}

        {[
          { label: "›", disabled: safePage === totalPages, onClick: () => setPage(Math.min(totalPages, safePage + 1)) },
          { label: "»", disabled: safePage === totalPages, onClick: () => setPage(totalPages) },
        ].map(({ label, disabled, onClick }) => (
          <button key={label} onClick={onClick} disabled={disabled}
            style={{ ...btnBase, ...(disabled ? { color: "#d1d5db", cursor: "not-allowed" } : { color: "#374151", backgroundColor: "#fff" }) }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CATALOG PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Catalog() {
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogItem | null>(null);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected((prev) => { const next = new Set(prev); paginated.forEach((p) => next.delete(p.id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); paginated.forEach((p) => next.add(p.id)); return next; });
    }
  }

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

  return (
    <div style={{ padding: "1rem", maxWidth: "1280px", margin: "0 auto" }}>

      {/* MODALS */}
      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} onSuccess={loadData} />}
      {showImportUrl  && <ImportUrlModal  onClose={() => setShowImportUrl(false)}  onSuccess={loadData} />}
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

      {/* HEADER */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>POSTIKA</p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.2 }}>Catalog</h1>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: 4 }}>Manage tenant products.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setShowBulkUpload(true)} style={{ ...S.btnDark, padding: "0.5rem 0.875rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            📦 Bulk Upload ZIP
          </button>
          <button onClick={() => setShowImportUrl(true)} style={{ ...S.btnDark, padding: "0.5rem 0.875rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            🌐 Import URL
          </button>
          <button onClick={() => setShowAddProduct(true)} style={{ ...S.btnBlue, padding: "0.5rem 0.875rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            + Add Product
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {loadError && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.75rem", fontSize: "0.875rem", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          ⚠ {loadError}
          <button onClick={loadData} style={{ ...S.btnOutline, fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.5rem", borderRadius: "0.375rem", cursor: "pointer", marginLeft: "1rem" }}>Retry</button>
        </div>
      )}

      {/* SEARCH + BULK DELETE */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "0.75rem", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: "0.875rem", outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }}
          />
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            style={{ ...S.btnRed, padding: "0.5rem 1rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600, cursor: bulkDeleting ? "not-allowed" : "pointer", opacity: bulkDeleting ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            {bulkDeleting && <Spinner />}🗑 Delete {selected.size} selected
          </button>
        )}
      </div>

      {/* LOADING */}
      {dataLoading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5rem 0", color: "#9ca3af", gap: "0.75rem", fontSize: "0.875rem" }}>
          <Spinner /> Loading catalog…
        </div>
      )}

      {/* TABLE + CARDS */}
      {!dataLoading && (
        <>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", backgroundColor: "#fff" }}>

            {/* ── MOBILE CARDS (< 768px) ── */}
            <div className="md:hidden" style={{ borderTop: "none" }}>
              {paginated.length === 0 && (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
                  {products.length === 0 ? "No products yet — add some above." : "No products match your search."}
                </div>
              )}
              {paginated.map((product) => {
                const isChecked = selected.has(product.id);
                const isOpen = openPreviewId === product.id;
                return (
                  <div key={product.id} style={{ padding: "1rem", borderBottom: "1px solid #f3f4f6", backgroundColor: isChecked ? "#fef2f2" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(product.id)}
                        style={{ marginTop: 4, cursor: "pointer", accentColor: "#ef4444", width: 16, height: 16, flexShrink: 0 }} />
                      {product.image_url
                        ? <img src={product.image_url} alt={stripHtml(product.title)}
                            style={{ width: 64, height: 64, borderRadius: "0.75rem", objectFit: "cover", border: "1px solid #e5e7eb", flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <div style={{ width: 64, height: 64, borderRadius: "0.75rem", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: "0.75rem", flexShrink: 0 }}>IMG</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: "#111827", fontSize: "0.875rem", lineHeight: 1.3, margin: 0 }}>{stripHtml(product.title)}</p>
                        {product.sku && <p style={{ fontSize: "0.7rem", color: "#9ca3af", margin: "2px 0 0" }}>SKU: {product.sku}</p>}
                        <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "4px 0 0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{stripHtml(product.description)}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#111827" }}>{formatPrice(product)}</span>
                          <StatusBadge status={product.status} />
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <button onClick={() => setOpenPreviewId(isOpen ? null : product.id)}
                            style={{ ...(isOpen ? S.btnIndigo : S.btnIndigoOutline), fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>
                            {isOpen ? "Hide" : "✨ Caption"}
                          </button>
                          <button onClick={() => setEditingProduct(product)}
                            style={{ ...S.btnOutline, fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => handleDelete(product.id)}
                            style={{ ...S.btnDeleteOutline, fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP TABLE (md+) ── */}
            <table className="hidden md:table" style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {/* Checkbox */}
                  <th style={{ padding: "0.75rem", width: 44, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = someOnPageSelected; }}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", accentColor: "#ef4444", width: 16, height: 16 }}
                    />
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Product</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>SKU</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Price</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Status</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
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
                      <tr style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: isChecked ? "#fef2f2" : "transparent", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { if (!isChecked) (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb"; }}
                        onMouseLeave={(e) => { if (!isChecked) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>

                        {/* Checkbox */}
                        <td style={{ padding: "0.75rem", textAlign: "center" }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(product.id)}
                            style={{ cursor: "pointer", accentColor: "#ef4444", width: 16, height: 16 }} />
                        </td>

                        {/* Product */}
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {product.image_url
                              ? <img src={product.image_url} alt={cleanTitle}
                                  style={{ width: 48, height: 48, borderRadius: "0.75rem", objectFit: "cover", border: "1px solid #e5e7eb", flexShrink: 0 }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <div style={{ width: 48, height: 48, borderRadius: "0.75rem", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: "0.75rem", flexShrink: 0 }}>IMG</div>}
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{cleanTitle}</p>
                              <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{cleanDesc}</p>
                            </div>
                          </div>
                        </td>

                        {/* SKU — always visible, no lg:hidden */}
                        <td style={{ padding: "0.75rem", color: "#6b7280", fontSize: "0.75rem" }}>
                          {product.sku || "—"}
                        </td>

                        {/* Price */}
                        <td style={{ padding: "0.75rem", fontWeight: 600, color: "#111827" }}>
                          {formatPrice(product)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "0.75rem" }}>
                          <StatusBadge status={product.status} />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => setOpenPreviewId(isOpen ? null : product.id)}
                              style={{ ...(isOpen ? S.btnIndigo : S.btnIndigoOutline), fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>
                              {isOpen ? "Hide" : "✨ Caption"}
                            </button>
                            <button onClick={() => setEditingProduct(product)}
                              style={{ ...S.btnOutline, fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>
                              Edit
                            </button>
                            <button onClick={() => handleDelete(product.id)}
                              style={{ ...S.btnDeleteOutline, fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 500, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Caption preview inline row */}
                      {isOpen && (
                        <CaptionPreviewPanel product={product} templates={templates}
                          onClose={() => setOpenPreviewId(null)} />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <PaginationBar
            filtered={filtered}
            pageSize={pageSize}
            setPageSize={setPageSize}
            safePage={safePage}
            totalPages={totalPages}
            setPage={setPage}
          />

          {/* FOOTER COUNT */}
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 8 }}>
            Showing {paginated.length > 0 ? `${pageStart + 1}–${pageStart + paginated.length}` : "0"} of{" "}
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            {selected.size > 0 ? ` · ${selected.size} selected` : ""}
          </p>
        </>
      )}
    </div>
  );
}