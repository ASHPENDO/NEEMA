import React, { useCallback, useEffect, useMemo, useState } from "react";
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

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ProductFormModalState>({ open: false });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ created: number; errors: number } | null>(
    null
  );

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
    if (!tenantId) {
      setTenantName("");
      return;
    }

    try {
      const tenants = await getTenants<TenantSummary[]>();
      const active = Array.isArray(tenants) ? tenants.find((t) => t.id === tenantId) : undefined;
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
      if (checked) {
        return Array.from(new Set([...prev, ...visibleIds]));
      }
      return prev.filter((id) => !visibleIds.includes(id));
    });
  }

  async function handleCreate(payload: CatalogCreateRequest) {
    try {
      setBusy(true);
      setError(null);
      setPageMessage("");

      const created = await createCatalogItem(payload);
      setItems((prev) => [created, ...prev]);
      setModal({ open: false });
      setPageMessage("Product created successfully.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create catalog item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(item: CatalogItem, payload: CatalogUpdateRequest) {
    try {
      setBusy(true);
      setError(null);
      setPageMessage("");

      const updated = await updateCatalogItem(item.id, payload);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
      setModal({ open: false });
      setPageMessage("Product updated successfully.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update catalog item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: CatalogItem) {
    const confirmed = window.confirm(`Delete "${item.title}"? This action cannot be undone.`);
    if (!confirmed) return;

    const previousItems = items;
    const previousSelectedIds = selectedIds;

    try {
      setBusy(true);
      setError(null);
      setPageMessage("");

      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));

      await deleteCatalogItem(item.id);
      setPageMessage("Product deleted successfully.");
    } catch (e) {
      setItems(previousItems);
      setSelectedIds(previousSelectedIds);
      setError(e instanceof ApiError ? e.message : "Failed to delete catalog item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (!selectedCount) return;

    const visibleSelectedIds = selectedIds.filter((id) =>
      filteredItems.some((item) => item.id === id)
    );

    if (!visibleSelectedIds.length) return;

    const confirmed = window.confirm(
      `Delete ${visibleSelectedIds.length} selected product${
        visibleSelectedIds.length === 1 ? "" : "s"
      }? This action cannot be undone.`
    );
    if (!confirmed) return;

    const previousItems = items;
    const previousSelectedIds = selectedIds;

    try {
      setBusy(true);
      setError(null);
      setPageMessage("");

      setItems((prev) => prev.filter((item) => !visibleSelectedIds.includes(item.id)));
      setSelectedIds((prev) => prev.filter((id) => !visibleSelectedIds.includes(id)));

      await bulkDeleteCatalogItems(visibleSelectedIds);

      setPageMessage(
        `${visibleSelectedIds.length} product${
          visibleSelectedIds.length === 1 ? "" : "s"
        } deleted successfully.`
      );
    } catch (e) {
      setItems(previousItems);
      setSelectedIds(previousSelectedIds);
      setError(e instanceof ApiError ? e.message : "Failed to delete selected catalog items.");
    } finally {
      setBusy(false);
    }
  }

  async function handleZipUpload(file: File) {
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSummary(null);
      setPageMessage("");

      const result = await bulkUploadCatalogZip(file);
      const createdCount = Array.isArray(result.created) ? result.created.length : 0;
      const errorsCount = Array.isArray(result.errors) ? result.errors.length : 0;

      setUploadSummary({
        created: createdCount,
        errors: errorsCount,
      });

      await loadCatalog();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : "Bulk ZIP upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const handleImportFromUrlSuccess = async (result: CatalogScrapeResponse) => {
    await loadCatalog();
    const createdCount = result.created?.length ?? 0;
    setPageMessage(`Imported ${createdCount} product${createdCount === 1 ? "" : "s"} from URL.`);
  };

  return (
    <PageShell
      title="Catalog"
      subtitle="Manage tenant products. Create, edit, delete, bulk-upload catalog items, and import from website URLs."
      workspaceName={tenantName || undefined}
      right={
        <div className="flex flex-wrap items-center gap-2">
          {canImport && (
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept=".zip"
                className="hidden"
                disabled={uploading || busy || !ready}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void handleZipUpload(file);
                }}
              />
              <Button variant="secondary" disabled={uploading || busy || !ready}>
                {uploading ? "Uploading..." : "Bulk upload ZIP"}
              </Button>
            </label>
          )}

          {canWrite && (
            <button
              type="button"
              onClick={() => setImportUrlOpen(true)}
              disabled={busy || uploading || !ready}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Import from URL
            </button>
          )}

          {canWrite && (
            <Button
              onClick={() => setModal({ open: true, mode: "create" })}
              disabled={busy || uploading || !ready}
            >
              Add product
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, SKU, description..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void loadCatalog()}
              disabled={!ready || loading || busy || uploading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {canDelete && selectedCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <span className="font-medium">{selectedCount}</span>{" "}
              selected
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                onClick={() => void handleBulkDelete()}
                disabled={busy || uploading || loading}
              >
                Delete Selected
              </Button>

              <Button
                variant="secondary"
                disabled
                title="Create Campaign will be wired in the next phase."
              >
                Create Campaign
              </Button>
            </div>
          </div>
        ) : null}

        {pageMessage ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {pageMessage}
          </div>
        ) : null}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {uploadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        {uploadSummary && (
          <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm">
            <div className="font-medium">Bulk upload completed</div>
            <div className="mt-1 opacity-70">
              Created: <span className="font-medium">{uploadSummary.created}</span> · Errors:{" "}
              <span className="font-medium">{uploadSummary.errors}</span>
            </div>
          </div>
        )}

        {!ready ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm opacity-70">
            Resolving tenant access...
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm opacity-70">
            Loading catalog items...
          </div>
        ) : (
          <ProductTable
            items={filteredItems}
            canWrite={canWrite}
            canDelete={canDelete}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onEdit={(item) => setModal({ open: true, mode: "edit", initial: item })}
            onDelete={(item) => void handleDelete(item)}
          />
        )}
      </div>

      <ProductFormModal
        state={modal}
        busy={busy}
        onClose={() => setModal({ open: false })}
        onSubmit={(payload) => {
          if (!modal.open) return Promise.resolve();

          if (modal.mode === "create") {
            return handleCreate(payload as CatalogCreateRequest);
          }

          return handleEdit(modal.initial, payload as CatalogUpdateRequest);
        }}
      />

      <ImportFromUrlModal
        open={importUrlOpen}
        onClose={() => setImportUrlOpen(false)}
        onSuccess={handleImportFromUrlSuccess}
      />
    </PageShell>
  );
}