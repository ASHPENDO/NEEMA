// src/pages/Catalog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import {
  type CatalogItem,
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  bulkUploadCatalogZip,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { canDeleteCatalog, canImportCatalog, canReadCatalog, canWriteCatalog } from "../auth/permissions";
import { ProductTable } from "../components/catalog/ProductTable";
import { ProductFormModal, type ProductFormModalState } from "../components/catalog/ProductFormModal";

function normalizeSearch(s: string) {
  return s.trim().toLowerCase();
}

export default function Catalog() {
  const { me } = useAuth();

  const canRead = canReadCatalog(me);
  const canWrite = canWriteCatalog(me);
  const canImport = canImportCatalog(me);
  const canDelete = canDeleteCatalog(me);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ProductFormModalState>({ open: false });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ created: number; errors: number } | null>(null);

  const filtered = useMemo(() => {
    const s = normalizeSearch(q);
    if (!s) return items;

    return items.filter((p) => {
      const hay = `${p.name ?? ""} ${p.sku ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  async function refresh() {
    if (!canRead) {
      setError("You don’t have permission to view products.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listCatalogItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(payload: any) {
    try {
      setBusy(true);
      setError(null);
      const created = await createCatalogItem(payload);
      setItems((prev) => [created, ...prev]);
      setModal({ open: false });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create product.");
    } finally {
      setBusy(false);
    }
  }

  async function onEdit(item: CatalogItem, payload: any) {
    try {
      setBusy(true);
      setError(null);
      const updated = await updateCatalogItem(item.id, payload);
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
      setModal({ open: false });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update product.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item: CatalogItem) {
    const ok = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      setBusy(true);
      setError(null);
      await deleteCatalogItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete product.");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadZip(file: File) {
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSummary(null);

      const res = await bulkUploadCatalogZip(file);

      const createdCount = Array.isArray(res.created) ? res.created.length : 0;
      const errorsCount = Array.isArray(res.errors) ? res.errors.length : 0;

      setUploadSummary({ created: createdCount, errors: errorsCount });

      // refresh list because upload creates many products
      await refresh();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageShell
      title="Products"
      subtitle="Manage your product catalog. Bulk upload supports ZIP bundles with details.json per product."
      right={
        <div className="flex gap-2">
          {canImport && (
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept=".zip"
                className="hidden"
                disabled={uploading || busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (f) onUploadZip(f);
                }}
              />
              <Button variant="secondary" disabled={uploading || busy}>
                {uploading ? "Uploading..." : "Bulk upload ZIP"}
              </Button>
            </label>
          )}

          {canWrite ? (
            <Button onClick={() => setModal({ open: true, mode: "create" })} disabled={busy || uploading}>
              Add product
            </Button>
          ) : (
            <div className="text-xs opacity-60 self-center">No write access</div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name, SKU…" />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refresh} disabled={loading || busy || uploading}>
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {uploadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
        ) : null}

        {uploadSummary ? (
          <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm">
            <div className="font-medium">Bulk upload finished</div>
            <div className="mt-1 opacity-70">
              Created: <span className="font-medium">{uploadSummary.created}</span> · Errors:{" "}
              <span className="font-medium">{uploadSummary.errors}</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm opacity-70">Loading…</div>
        ) : (
          <ProductTable
            items={filtered}
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={(p) => setModal({ open: true, mode: "edit", initial: p })}
            onDelete={onDelete}
          />
        )}
      </div>

      <ProductFormModal
        state={modal}
        busy={busy}
        onClose={() => setModal({ open: false })}
        onSubmit={(payload) => {
          if (!modal.open) return Promise.resolve();
          if (modal.mode === "create") return onCreate(payload);
          return onEdit(modal.initial, payload);
        }}
      />
    </PageShell>
  );
}