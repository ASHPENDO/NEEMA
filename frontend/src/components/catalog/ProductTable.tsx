// src/components/catalog/ProductTable.tsx
import React from "react";
import type { CatalogItem } from "../../lib/api";
import { Button } from "../Button";

function formatMoney(value?: number | null, currency?: string | null) {
  if (value == null) return "—";

  const resolvedCurrency = currency || "KES";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: resolvedCurrency,
    }).format(value);
  } catch {
    return `${resolvedCurrency} ${value}`;
  }
}

type ProductTableProps = {
  items: CatalogItem[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
};

export function ProductTable({
  items,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: ProductTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm">
        <div className="font-medium">No products yet</div>
        <div className="mt-1 opacity-70">Create your first product or use bulk upload.</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-black/5 align-top">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/[0.03]">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium">{item.name}</div>
                      {item.description ? (
                        <div className="mt-0.5 line-clamp-2 text-xs opacity-70">{item.description}</div>
                      ) : (
                        <div className="mt-0.5 text-xs opacity-50">No description</div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">{item.sku || "—"}</td>
                <td className="px-4 py-3">{formatMoney(item.price, item.currency)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs">
                    {item.is_active === false ? "Inactive" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}