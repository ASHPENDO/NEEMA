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

  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("KES");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setTitle(initial.title ?? "");
      setSku(initial.sku ?? "");
      setPriceAmount(initial.price_amount == null ? "" : String(initial.price_amount));
      setPriceCurrency(initial.price_currency ?? "KES");
      setDescription(initial.description ?? "");
      setStatus(initial.status ?? "active");
      return;
    }

    setTitle("");
    setSku("");
    setPriceAmount("");
    setPriceCurrency("KES");
    setDescription("");
    setStatus("active");
  }, [open, initial]);

  const numericPrice = useMemo(() => {
    if (priceAmount.trim() === "") return NaN;
    const n = Number(priceAmount);
    return Number.isFinite(n) ? n : NaN;
  }, [priceAmount]);

  const isPriceValid = Number.isFinite(numericPrice) && numericPrice > 0;

  if (!open) return null;

  async function handleSubmit() {
    if (!title.trim()) return;
    if (!isPriceValid) return;

    if (state.mode === "create") {
      const payload: CatalogCreateRequest = {
        title: title.trim(),
        sku: sku.trim() || null,
        description: description.trim() || null,
        price_amount: Number(priceAmount),
        price_currency: priceCurrency.trim() || "KES",
      };

      await onSubmit(payload);
      return;
    }

    const payload: CatalogUpdateRequest = {
      title: title.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
      price_amount: Number(priceAmount),
      price_currency: priceCurrency.trim() || "KES",
      status,
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
            label="Title *"
            value={title}
            onChange={setTitle}
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
              value={priceCurrency}
              onChange={setPriceCurrency}
              placeholder="KES"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <InputField
                label="Price *"
                value={priceAmount}
                onChange={setPriceAmount}
                placeholder="e.g. 1200"
                inputMode="decimal"
              />
              {!isPriceValid && (
                <div className="mt-1 text-xs text-red-600">Enter a valid price greater than 0.</div>
              )}
            </div>

            {state.mode === "edit" ? (
              <div>
                <div className="mb-1 text-xs font-medium opacity-70">Status</div>
                <select
                  className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={busy}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <div className="text-xs opacity-60">New products are created as active.</div>
              </div>
            )}
          </div>

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
          <Button onClick={() => void handleSubmit()} disabled={busy || !title.trim() || !isPriceValid}>
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