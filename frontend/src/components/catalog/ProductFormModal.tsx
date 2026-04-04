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
  const [imageUrl, setImageUrl] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("KES");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setTitle(initial.title ?? "");
      setSku(initial.sku ?? "");
      setImageUrl(initial.image_url ?? "");
      setPriceAmount(initial.price_amount == null ? "" : String(initial.price_amount));
      setPriceCurrency(initial.price_currency ?? "KES");
      setDescription(initial.description ?? "");
      setStatus(initial.status ?? "active");
      return;
    }

    setTitle("");
    setSku("");
    setImageUrl("");
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

  const normalizedImageUrl = useMemo(() => {
    const value = imageUrl.trim();
    return value ? value : null;
  }, [imageUrl]);

  if (!open) return null;

  async function handleSubmit() {
    if (busy) return;
    if (!title.trim()) return;
    if (!isPriceValid) return;

    if (state.mode === "create") {
      await onSubmit({
        title: title.trim(),
        sku: sku.trim() || null,
        description: description.trim() || null,
        image_url: normalizedImageUrl,
        price_amount: Number(priceAmount),
        price_currency: priceCurrency.trim() || "KES",
      });
      return;
    }

    await onSubmit({
      title: title.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
      image_url: normalizedImageUrl,
      price_amount: Number(priceAmount),
      price_currency: priceCurrency.trim() || "KES",
      status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">

        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="text-lg font-semibold">
            {state.mode === "create" ? "Add product" : "Edit product"}
          </div>
          <button onClick={onClose} disabled={busy}>✕</button>
        </div>

        <div className="p-4 space-y-3">

          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />

          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />

          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" />

          <Input value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} placeholder="Price" />

          <Input value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)} placeholder="Currency" />

          <textarea
            className="w-full border rounded p-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>

      </div>
    </div>
  );
}