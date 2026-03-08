// src/components/catalog/ProductTable.tsx
import React, { useMemo, useState } from "react";
import type { CatalogItem } from "../../lib/api";
import { Button } from "../Button";

function formatMoney(value?: string | number | null, currency?: string | null) {
  if (value == null || value === "") return "—";

  const resolvedCurrency = currency || "KES";
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return `${resolvedCurrency} ${value}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: resolvedCurrency,
    }).format(amount);
  } catch {
    return `${resolvedCurrency} ${amount}`;
  }
}

function formatStatus(status?: string | null) {
  if (!status) return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type ProductTableProps = {
  items: CatalogItem[];
  canWrite: boolean;
  canDelete: boolean;
  selectedIds: string[];
  onToggleSelect: (itemId: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
};

export function ProductTable({
  items,
  canWrite,
  canDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));
  const someSelected = items.some((item) => selectedSet.has(item.id));

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm">
        <div className="font-medium">No products yet</div>
        <div className="mt-1 opacity-70">
          Create your first product, import from URL, or use bulk upload.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="w-12 px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  aria-label={allSelected ? "Deselect all products" : "Select all products"}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-black/20"
                />
              </th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="sticky right-0 z-10 w-[180px] bg-black/[0.03] px-4 py-3 font-medium text-right shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.15)]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <ProductRow
                key={item.id}
                item={item}
                canWrite={canWrite}
                canDelete={canDelete}
                selected={selectedSet.has(item.id)}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({
  item,
  canWrite,
  canDelete,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  item: CatalogItem;
  canWrite: boolean;
  canDelete: boolean;
  selected: boolean;
  onToggleSelect: (itemId: string) => void;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.image_url && !imageFailed);

  return (
    <tr className="border-t border-black/5 align-top">
      <td className="px-4 py-3">
        <div className="flex items-center justify-center pt-1">
          <input
            type="checkbox"
            aria-label={`Select ${item.title}`}
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            className="h-4 w-4 rounded border-black/20"
          />
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-black/[0.03]">
            {hasImage ? (
              <img
                src={item.image_url ?? undefined}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-45">
                No image
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="font-medium">{item.title}</div>
            {item.description ? (
              <div className="mt-0.5 line-clamp-2 text-xs opacity-70">{item.description}</div>
            ) : (
              <div className="mt-0.5 text-xs opacity-50">No description</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">{item.sku || "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {formatMoney(item.price_amount, item.price_currency)}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs">
          {formatStatus(item.status)}
        </span>
      </td>
      <td className="sticky right-0 z-[1] bg-white px-4 py-3 whitespace-nowrap shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.15)]">
        <div className="flex justify-end gap-2">
          {canWrite && (
            <Button variant="secondary" onClick={() => onEdit(item)}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => onDelete(item)}>
              Delete
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}