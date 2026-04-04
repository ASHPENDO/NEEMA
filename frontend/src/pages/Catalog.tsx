// src/pages/catalog.tsx

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import ImportFromUrlModal from "../components/catalog/ImportFromUrlModal";
import {
  ApiError,
  getTenants,
  type CatalogCreateRequest,
  type CatalogItem,
  type CatalogScrapeResponse,
  type CatalogUpdateRequest,
  bulkDeleteCatalogItems,
  bulkUploadCatalogZip,
  createCatalogItem,
  deleteCatalogItem,
  listCatalogItems,
  updateCatalogItem,
} from "../lib/api";
import { useAccess } from "../hooks/useAccess";
import {
  canDeleteCatalog,
  canImportCatalog,
  canReadCatalog,
  canWriteCatalog,
} from "../auth/permissions";
import { ProductTable } from "../components/catalog/ProductTable";
import {
  ProductFormModal,
  type ProductFormModalState,
} from "../components/catalog/ProductFormModal";

/* ✅ NEW IMPORT */
import TemplatePreview from "../components/templates/TemplatePreview";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

type TenantSummary = {
  id: string;
  name: string;
};

export default function Catalog() {
  const { membership, ready, tenantId } = useAccess();

  const canRead = canReadCatalog(membership);
  const canWrite = canWriteCatalog(membership);
  const canImport = canImportCatalog(membership);
  const canDelete = canDeleteCatalog(membership);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ProductFormModalState>({ open: false });

  /* ✅ NEW STATE */
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ created: number; errors: number } | null>(null);

  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const [pageMessage, setPageMessage] = useState<string>("");

  const [tenantName, setTenantName] = useState<string>("");

  const filteredItems = useMemo(() => {
    const search = normalizeSearch(q);
    if (!search) return items;

    return items.filter((item) => {
      const haystack =
        `${item.title ?? ""} ${item.sku ?? ""} ${item.description ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [items, q]);

  const selectedCount = useMemo(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    return selectedIds.filter((id) => visibleIds.has(id)).length;
  }, [filteredItems, selectedIds]);

  const loadCatalog = useCallback(async () => {
    if (!tenantId) {
      setItems([]);
      setSelectedIds([]);
      setError("Select a tenant to view catalog items.");
      setLoading(false);
      return;
    }

    if (!canRead) {
      setItems([]);
      setSelectedIds([]);
      setError("You do not have permission to view catalog items.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listCatalogItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load catalog items.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  const loadActiveTenantName = useCallback(async () => {
    if (!tenantId) return;

    try {
      const tenants = await getTenants<TenantSummary[]>();
      const active = tenants?.find((t) => t.id === tenantId);
      setTenantName(active?.name ?? "");
    } catch {
      setTenantName("");
    }
  }, [tenantId]);

  useEffect(() => {
    if (!ready) return;
    void loadCatalog();
  }, [ready, loadCatalog]);

  useEffect(() => {
    if (!ready) return;
    void loadActiveTenantName();
  }, [ready, loadActiveTenantName]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  function handleToggleSelect(itemId: string) {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  function handleToggleSelectAll(checked: boolean) {
    const visibleIds = filteredItems.map((item) => item.id);

    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ...visibleIds]));
      return prev.filter((id) => !visibleIds.includes(id));
    });
  }

  async function handleCreate(payload: CatalogCreateRequest) {
    try {
      setBusy(true);
      setError(null);
      const created = await createCatalogItem(payload);
      setItems((prev) => [created, ...prev]);
      setModal({ open: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(item: CatalogItem, payload: CatalogUpdateRequest) {
    try {
      setBusy(true);
      const updated = await updateCatalogItem(item.id, payload);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
      setModal({ open: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: CatalogItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await deleteCatalogItem(item.id);
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
  }

  async function handleZipUpload(file: File) {
    try {
      setUploading(true);
      const result = await bulkUploadCatalogZip(file);

      setUploadSummary({
        created: result.created?.length ?? 0,
        errors: result.errors?.length ?? 0,
      });

      await loadCatalog();
    } catch (e) {
      setUploadError("Bulk upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageShell
      title="Catalog"
      subtitle="Manage tenant products."
      workspaceName={tenantName || undefined}
      right={
        <div className="flex gap-2">

          {canImport && (
            <>
              <input
                type="file"
                accept=".zip"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void handleZipUpload(file);
                }}
              />

              <Button onClick={() => fileInputRef.current?.click()}>
                {uploading ? "Uploading..." : "Bulk upload ZIP"}
              </Button>
            </>
          )}

          <Button onClick={() => setImportUrlOpen(true)}>Import URL</Button>

          <Button onClick={() => setModal({ open: true, mode: "create" })}>
            Add product
          </Button>
        </div>
      }
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />

      {/* ✅ FULL WIDTH TABLE */}
      <div className="mt-4">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ProductTable
            items={filteredItems}
            canWrite={canWrite}
            canDelete={canDelete}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onEdit={(item) => {
              setSelectedProduct(item);
              setModal({ open: true, mode: "edit", initial: item });
            }}
            onDelete={(item) => void handleDelete(item)}
            onRowClick={(item) => setSelectedProduct(item)} /* ✅ IMPORTANT */
          />
        )}
      </div>

      {/* ✅ FLOATING TEMPLATE PANEL */}
      <div className="fixed top-20 right-4 w-[320px] z-40">
        <TemplatePreview
          product={selectedProduct}
          allProducts={items}
        />
      </div>

      <ProductFormModal
        state={modal}
        busy={busy}
        onClose={() => setModal({ open: false })}
        onSubmit={(payload) =>
          modal.mode === "create"
            ? handleCreate(payload as CatalogCreateRequest)
            : handleEdit(modal.initial, payload as CatalogUpdateRequest)
        }
      />

      <ImportFromUrlModal
        open={importUrlOpen}
        onClose={() => setImportUrlOpen(false)}
        onSuccess={async () => await loadCatalog()}
      />
    </PageShell>
  );
}