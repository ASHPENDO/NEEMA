import { useState, useEffect, useRef, Fragment } from "react";
import {
  listCatalogItems,
  createCatalogItem,
  deleteCatalogItem,
  bulkDeleteCatalogItems,
  bulkUploadCatalogZip,
  scrapeCatalogItems,
  get,
  post,
  type CatalogItem,
  type CatalogCreateRequest,
} from "../lib/api";

// ─── Local types ──────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
}

interface CaptionPreview {
  templateId: string;
  caption: string;
  loading: boolean;
}

// ─── Shared modal wrapper ─────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Bulk Upload ZIP modal ────────────────────────────────────────────────────

function BulkUploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) { setError("Please select a ZIP file."); return; }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip files are accepted.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      // ✅ Uses the real apiForm helper via bulkUploadCatalogZip()
      await bulkUploadCatalogZip(file);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Bulk Upload ZIP" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Upload a ZIP file containing product images and an optional{" "}
        <code className="bg-gray-100 px-1 rounded">products.csv</code> or{" "}
        <code className="bg-gray-100 px-1 rounded">products.json</code> manifest.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition mb-4"
      >
        {file ? (
          <div>
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-2">📦</p>
            <p className="text-gray-500 text-sm">Click to select a ZIP file</p>
            <p className="text-gray-400 text-xs mt-1">or drag and drop</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setError(""); }
          }}
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded border text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={loading || !file}
          className="px-4 py-2 rounded bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Import URL modal ─────────────────────────────────────────────────────────

function ImportUrlModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleImport() {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    try { new URL(trimmed); } catch {
      setError("Please enter a valid URL (include https://).");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      // ✅ Uses the real scrapeCatalogItems() with correct endpoint + payload shape
      const res = await scrapeCatalogItems({
        url: trimmed,
        max_items: parseInt(maxItems) || 20,
        allow_fallback: true,
        try_shopify_product_json: true,
        try_woocommerce_store_api: true,
        crawl_product_pages: true,
      });

      setResult({ created: res.created.length, skipped: res.skipped });
      onSuccess();
      // Keep modal open briefly to show result, then close
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err?.message || "Import failed. The site may be blocking scraping.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Import from URL" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Paste the URL of a product listing page (e.g. Jumia, Jiji, Shopify store,
        WooCommerce). We'll scrape and import the products automatically.
      </p>

      <div className="space-y-3 mb-3">
        <input
          type="url"
          placeholder="https://example.com/products"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Max items:</label>
          <select
            value={maxItems}
            onChange={(e) => setMaxItems(e.target.value)}
            className="border rounded px-2 py-1 text-xs bg-white focus:outline-none"
          >
            {["10", "20", "50", "100"].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {result && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✓ Imported {result.created} products
          {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded border text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Add Product modal ────────────────────────────────────────────────────────

function AddProductModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    sku: "",
    price_amount: "",       // ✅ real field name from CatalogCreateRequest
    price_currency: "KES",  // ✅ real field name
    image_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleAdd() {
    if (!form.title.trim()) { setError("Product title is required."); return; }
    if (!form.price_amount) { setError("Price is required."); return; }

    try {
      setLoading(true);
      setError("");

      const payload: CatalogCreateRequest = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        price_amount: parseFloat(form.price_amount),
        price_currency: form.price_currency || "KES",
        image_url: form.image_url.trim() || null,
      };

      // ✅ Uses real createCatalogItem() → POST /api/v1/catalog/items
      await createCatalogItem(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to add product. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Product" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            placeholder="Samsung Galaxy S10"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Description
          </label>
          <textarea
            placeholder="256GB, excellent condition…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">SKU</label>
            <input
              placeholder="SKU-001"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Price <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1">
              <select
                value={form.price_currency}
                onChange={(e) => set("price_currency", e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white focus:outline-none w-20"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="UGX">UGX</option>
                <option value="TZS">TZS</option>
              </select>
              <input
                type="number"
                placeholder="205000"
                value={form.price_amount}
                onChange={(e) => set("price_amount", e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Image URL
          </label>
          <input
            type="url"
            placeholder="https://…/image.jpg"
            value={form.image_url}
            onChange={(e) => set("image_url", e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 rounded bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add Product"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Catalog page ────────────────────────────────────────────────────────

export default function Catalog() {
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Caption previews
  const [previews, setPreviews] = useState<Record<string, CaptionPreview>>({});
  const [previewTemplates, setPreviewTemplates] = useState<Record<string, string>>({});
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());

  // Modal visibility
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // ── Derived filter — declared BEFORE handlers that reference it ──────────
  const filtered = products.filter(
    (p) =>
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0 && !allSelected;

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoadError("");

      // ✅ listCatalogItems() returns CatalogItem[] directly (no .data wrapper)
      // ✅ templates still uses generic get() which also returns T directly
      const [items, tRes] = await Promise.all([
        listCatalogItems(),
        get<Template[]>("/api/v1/templates/"),
      ]);

      setProducts(Array.isArray(items) ? items : []);
      setTemplates(Array.isArray(tRes) ? tRes : []);
    } catch (err: any) {
      console.error("Failed to load catalog", err);
      setLoadError(err?.message || "Failed to load catalog. Check your connection.");
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
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  // ─── Bulk delete ───────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;

    try {
      setBulkDeleting(true);
      // ✅ Uses real bulkDeleteCatalogItems() → correct endpoint per item
      await bulkDeleteCatalogItems([...selected]);
      setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch (err) {
      alert("Some deletions failed. Please refresh and try again.");
      console.error(err);
    } finally {
      setBulkDeleting(false);
    }
  }

  // ─── Single delete ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      // ✅ Uses real deleteCatalogItem() → DELETE /api/v1/catalog/items/{id}
      await deleteCatalogItem(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.message || "Delete failed. Please try again.");
    }
  }

  // ─── Caption preview ───────────────────────────────────────────────────────

  function togglePreview(productId: string) {
    setOpenPreviews((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  }

  async function generatePreview(product: CatalogItem) {
    const templateId = previewTemplates[product.id] || templates[0]?.id;
    if (!templateId) { alert("No templates available."); return; }

    setPreviews((prev) => ({
      ...prev,
      [product.id]: { templateId, caption: "", loading: true },
    }));

    try {
      const payload: Record<string, string> = { product_id: product.id };
      if (templateId) payload.template_id = templateId;

      // post() returns T directly — no .data wrapper
      const data = await post<any>("/api/v1/ai/generate", payload);
      const caption =
        typeof data === "string"
          ? data
          : data?.full_caption || data?.caption || "No caption returned.";

      setPreviews((prev) => ({
        ...prev,
        [product.id]: { templateId, caption, loading: false },
      }));
    } catch (err: any) {
      setPreviews((prev) => ({
        ...prev,
        [product.id]: {
          templateId,
          caption: err?.message || "Failed to generate caption.",
          loading: false,
        },
      }));
    }
  }

  async function copyCaption(caption: string) {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      alert("Copy failed — select text manually.");
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">

      {/* ── MODALS ── */}
      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onSuccess={loadData}
        />
      )}
      {showImportUrl && (
        <ImportUrlModal
          onClose={() => setShowImportUrl(false)}
          onSuccess={loadData}
        />
      )}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onSuccess={loadData}
        />
      )}

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            POSTIKA
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">Manage tenant products.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 transition"
          >
            Bulk upload ZIP
          </button>
          <button
            onClick={() => setShowImportUrl(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 transition"
          >
            Import URL
          </button>
          <button
            onClick={() => setShowAddProduct(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 transition"
          >
            Add product
          </button>
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {loadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>⚠ {loadError}</span>
          <button
            onClick={loadData}
            className="text-red-700 font-semibold underline text-xs ml-4 hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── SEARCH + BULK DELETE BAR ── */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap transition"
          >
            {bulkDeleting ? "Deleting…" : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      {/* ── TABLE ── */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                  className="accent-red-500 cursor-pointer"
                />
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">Product</th>
              <th className="p-3 text-left font-semibold text-gray-700">SKU</th>
              <th className="p-3 text-left font-semibold text-gray-700">Price</th>
              <th className="p-3 text-left font-semibold text-gray-700">Status</th>
              <th className="p-3 text-left font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loadError && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  {products.length === 0
                    ? "No products yet — use the buttons above to add some."
                    : "No products match your search."}
                </td>
              </tr>
            )}

            {filtered.map((product) => {
              const isChecked = selected.has(product.id);
              const isOpen = openPreviews.has(product.id);
              const preview = previews[product.id];
              const chosenTemplateId =
                previewTemplates[product.id] || templates[0]?.id || "";

              // ✅ price lives in price_amount + price_currency on the real type
              const priceDisplay =
                product.price_amount != null
                  ? `${product.price_currency || "KES"} ${Number(
                      product.price_amount
                    ).toLocaleString()}`
                  : "—";

              return (
                // ✅ Named Fragment with key — required for sibling <tr> pairs
                <Fragment key={product.id}>
                  <tr
                    className={`border-b transition-colors ${
                      isChecked ? "bg-red-50" : "hover:bg-gray-50"
                    }`}
                  >
                    {/* CHECKBOX */}
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(product.id)}
                        className="accent-red-500 cursor-pointer"
                      />
                    </td>

                    {/* PRODUCT */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-10 h-10 rounded object-cover border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                            IMG
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{product.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="p-3 text-gray-600">{product.sku || "—"}</td>

                    {/* PRICE */}
                    <td className="p-3 text-gray-900">{priceDisplay}</td>

                    {/* STATUS */}
                    <td className="p-3">
                      {product.status?.toLowerCase() === "active" ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs font-medium">
                          {product.status || "—"}
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => togglePreview(product.id)}
                          className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition"
                        >
                          {isOpen ? "Hide Caption" : "Preview Caption"}
                        </button>
                        <button
                          onClick={() =>
                            (window.location.href = `/catalog/${product.id}/edit`)
                          }
                          className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ── INLINE CAPTION PREVIEW ROW ── */}
                  {isOpen && (
                    <tr className="bg-blue-50 border-b">
                      <td />
                      <td colSpan={5} className="p-4">
                        <div className="max-w-xl">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Caption Preview — {product.title}
                          </p>

                          <div className="flex items-center gap-2 mb-3">
                            <label className="text-xs text-gray-600 whitespace-nowrap">
                              Template:
                            </label>
                            <select
                              value={chosenTemplateId}
                              onChange={(e) =>
                                setPreviewTemplates((prev) => ({
                                  ...prev,
                                  [product.id]: e.target.value,
                                }))
                              }
                              className="border rounded px-2 py-1 text-xs flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              {templates.length === 0 && (
                                <option value="">No templates available</option>
                              )}
                              {templates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => generatePreview(product)}
                              disabled={preview?.loading || templates.length === 0}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50 transition"
                            >
                              {preview?.loading ? "Generating…" : "Generate"}
                            </button>
                          </div>

                          {preview?.loading && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                              Generating caption…
                            </div>
                          )}

                          {preview && !preview.loading && preview.caption && (
                            <div className="space-y-2">
                              <div className="bg-white border rounded-lg p-3 text-sm whitespace-pre-wrap text-gray-800">
                                {preview.caption}
                              </div>
                              <button
                                onClick={() => copyCaption(preview.caption)}
                                className="bg-gray-900 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium transition"
                              >
                                Copy Caption
                              </button>
                            </div>
                          )}

                          {!preview && (
                            <p className="text-xs text-gray-400 italic">
                              Select a template and click Generate to preview an AI
                              caption for this product.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER COUNT ── */}
      {products.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtered.length} of {products.length} product
          {products.length !== 1 ? "s" : ""}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
      )}
    </div>
  );
}
