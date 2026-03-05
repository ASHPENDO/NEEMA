// src/components/catalog/ProductFormModal.tsx
import React, { useEffect, useState } from "react";
import { CatalogCreateRequest, CatalogItem, CatalogUpdateRequest } from "../../lib/api";
import { Input } from "../Input";
import { Button } from "../Button";

export type ProductFormModalState =
  | { open: false }
  | { open: true; mode: "create"; initial?: undefined }
  | { open: true; mode: "edit"; initial: CatalogItem };

export function ProductFormModal({
  state,
  onClose,
  onSubmit,
  busy,
}: {
  state: ProductFormModalState;
  onClose: () => void;
  onSubmit: (payload: CatalogCreateRequest | CatalogUpdateRequest) => Promise<void>;
  busy: boolean;
}) {
  const open = state.open;
  const initial = state.open && state.mode === "edit" ? state.initial : null;

  const [name, setName] = useState("");
  const [sku, setSku] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("KES");
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name ?? "");
      setSku(String(initial.sku ?? ""));
      setPrice(initial.price == null ? "" : String(initial.price));
      setCurrency(initial.currency ?? "KES");
      setDescription(initial.description ?? "");
      setImageUrl(initial.image_url ?? "");
      setIsActive(initial.is_active ?? true);
    } else {
      setName("");
      setSku("");
      setPrice("");
      setCurrency("KES");
      setDescription("");
      setImageUrl("");
      setIsActive(true);
    }
  }, [open, initial?.id]);

  if (!open) return null;

  const parsedPrice = price.trim() === "" ? null : Number(price);
  const priceValid = price.trim() === "" || Number.isFinite(parsedPrice);

  async function submit() {
    if (!name.trim()) return;

    const base = {
      name: name.trim(),
      sku: sku.trim() ? sku.trim() : null,
      price: price.trim() === "" ? null : Number(price),
      currency: currency.trim() ? currency.trim() : null,
      description: description.trim() ? description.trim() : null,
      image_url: imageUrl.trim() ? imageUrl.trim() : null,
      is_active: isActive,
    };

    await onSubmit(base);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">
            {state.mode === "create" ? "Add product" : "Edit product"}
          </div>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <InputField label="Name *" value={name} onChange={setName} placeholder="e.g. Shea Butter Lotion" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField label="SKU" value={sku} onChange={setSku} placeholder="e.g. LOT-001" />
            <InputField label="Currency" value={currency} onChange={setCurrency} placeholder="KES" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField
              label="Price"
              value={price}
              onChange={setPrice}
              placeholder="e.g. 1200"
              inputMode="decimal"
            />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            </div>
          </div>
          <InputField label="Image URL" value={imageUrl} onChange={setImageUrl} placeholder="https://..." />
          <div>
            <div className="text-xs font-medium opacity-70">Description</div>
            <textarea
              className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short product description…"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !priceValid}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal";
}) {
  return (
    <div>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}