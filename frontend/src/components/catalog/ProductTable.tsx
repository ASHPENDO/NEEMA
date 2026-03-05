// src/components/catalog/ProductTable.tsx
import React from "react";
import { CatalogItem } from "../../lib/api";
import { Button } from "../Button";

function money(v?: number | null, currency?: string | null) {
  if (v == null) return "—";
  const cur = currency || "KES";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(v);
  } catch {
    return `${cur} ${v}`;
  }
}

export function ProductTable({
  items,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: {
  items: CatalogItem[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  if (!items.length) {
    return <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm opacity-70">No products yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.03]">
          <tr>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">SKU</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-black/5">
              <td className="px-4 py-3">
                <div className="font-medium">{p.name}</div>
                {p.description ? <div className="mt-0.5 line-clamp-1 text-xs opacity-70">{p.description}</div> : null}
              </td>
              <td className="px-4 py-3">{p.sku ?? "—"}</td>
              <td className="px-4 py-3">{money(p.price, p.currency)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs">
                  {p.is_active === false ? "Inactive" : "Active"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {canWrite && (
                    <Button variant="secondary" onClick={() => onEdit(p)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="danger" onClick={() => onDelete(p)}>
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
  );
}