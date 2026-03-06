// src/components/catalog/ProductFormModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { CatalogCreateRequest, CatalogItem, CatalogUpdateRequest } from "../../lib/api";
import { Input } from "../Input";
import { Button } from "../Button";

export type ProductFormModalState =
  | { open: false }
  | { open: true; mode: "create"; initial?: undefined }
  | { open: true; mode: "edit"; initial: CatalogItem };

type ProductFormModalProps = {
  state: ProductFormModalState;
  onClose: () => void;
  onSubmit: (payload: CatalogCreateRequest | CatalogUpdateRequest) => Promise<void>;
  busy: boolean;
};

export function ProductFormModal({
  state,
  onClose,
  onSubmit,
  busy,
}: ProductFormModalProps) {
  const open = state.open;
  const initial = state.open && state.mode === "edit" ? state.initial : null;

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setName(initial.name ?? "");
      setSku(initial.sku ?? "");
      setPrice(initial.price == null ? "" : String(initial.price));
      setCurrency(initial.currency ?? "KES");
      setDescription(initial.description ?? "");
      setImageUrl(initial.image_url ?? "");
      setIsActive(initial.is_active ?? true);
      return;
    }

    setName("");
    setSku("");
    setPrice("");
    setCurrency("KES");
    setDescription("");
    setImageUrl("");
    setIsActive(true);
  }, [open, initial]);

  const priceValue = useMemo(() => {
    if (price.trim() === "") return null;
    const n = Number(price);
    return Number.isFinite(n) ? n : NaN;
  }, [price]);

  const isPriceValid = price.trim() === "" || Number.isFinite(priceValue);

  if (!open) return null;

  async function handleSubmit() {
    if (!name.trim()) return;
    if (!isPriceValid) return;

    const payload: CatalogCreateRequest | CatalogUpdateRequest = {
      name: name.trim(),
      sku: sku.trim() || null,
      price: price.trim() === "" ? null : Number(price),
      currency: currency.trim() || null,
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
    };

    await onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">
            {state.mode === "create" ? "Add product" : "Edit product"}
          </div>
          <button
            type="button"
            className="text-sm opacity-70 hover:opacity-100"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <InputField
            label="Name *"
            value={name}
            onChange={setName}
            placeholder="e.g. Shea Butter Lotion"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField
              label="SKU"
              value={sku}
              onChange={setSku}
              placeholder="e.g. LOT-001"
            />
            <InputField
              label="Currency"
              value={currency}
              onChange={setCurrency}
              placeholder="KES"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <InputField
                label="Price"
                value={price}
                onChange={setPrice}
                placeholder="e.g. 1200"
                inputMode="decimal"
              />
              {!isPriceValid && (
                <div className="mt-1 text-xs text-red-600">Enter a valid numeric price.</div>
              )}
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>

          <InputField
            label="Image URL"
            value={imageUrl}
            onChange={setImageUrl}
            placeholder="https://..."
          />

          <div>
            <div className="mb-1 text-xs font-medium opacity-70">Description</div>
            <textarea
              className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short product description..."
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !name.trim() || !isPriceValid}>
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
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium opacity-70">{label}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}