// src/components/catalog/ImportFromUrlModal.tsx
import React, { useMemo, useState } from "react";
import { scrapeCatalogItems, ApiError, type CatalogScrapeResponse } from "../../lib/api";

type ImportFromUrlModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: CatalogScrapeResponse) => Promise<void> | void;
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.detail === "string") return error.detail;

    if (
      error.detail &&
      typeof error.detail === "object" &&
      "detail" in error.detail &&
      typeof (error.detail as any).detail === "string"
    ) {
      return (error.detail as any).detail;
    }

    return error.message || "Import failed.";
  }

  if (error instanceof Error) return error.message;
  return "Import failed.";
}

export default function ImportFromUrlModal({
  open,
  onClose,
  onSuccess,
}: ImportFromUrlModalProps) {
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState("20");
  const [crawlProductPages, setCrawlProductPages] = useState(true);
  const [allowFallback, setAllowFallback] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [resultMessage, setResultMessage] = useState<string>("");

  const urlValid = useMemo(() => isValidUrl(url.trim()), [url]);

  const resetState = () => {
    setUrl("");
    setMaxItems("20");
    setCrawlProductPages(true);
    setAllowFallback(true);
    setLoading(false);
    setError("");
    setResultMessage("");
  };

  const handleClose = () => {
    if (loading) return;
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResultMessage("");

    const trimmedUrl = url.trim();
    const parsedMaxItems = Number(maxItems);

    if (!trimmedUrl) {
      setError("Please enter a product or collection URL.");
      return;
    }

    if (!urlValid) {
      setError("Please enter a valid http or https URL.");
      return;
    }

    if (!Number.isFinite(parsedMaxItems) || parsedMaxItems < 1 || parsedMaxItems > 500) {
      setError("Max items must be between 1 and 500.");
      return;
    }

    try {
      setLoading(true);

      const result = await scrapeCatalogItems({
        url: trimmedUrl,
        max_items: parsedMaxItems,
        default_currency: "KES",
        try_woocommerce_store_api: true,
        crawl_product_pages: crawlProductPages,
        max_product_pages: 80,
        try_shopify_product_json: true,
        allow_fallback: allowFallback,
      });

      if (result.blocked) {
        setError(
          result.blocked_hint ||
            `The site blocked the request${result.blocked_status_code ? ` (${result.blocked_status_code})` : ""}.`
        );
        return;
      }

      const createdCount = result.created?.length ?? 0;

      if (createdCount === 0) {
        setError("No products were imported.");
        return;
      }

      setResultMessage(
        `Imported ${createdCount} product${createdCount === 1 ? "" : "s"} successfully.`
      );

      await onSuccess(result);
      handleClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import from URL</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste a product page or collection URL to import products into the catalog.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Product or collection URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/products/item-name"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Max items
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={maxItems}
              onChange={(e) => setMaxItems(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Use 1 for a single product URL, or a higher number for collection/category pages.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={crawlProductPages}
                onChange={(e) => setCrawlProductPages(e.target.checked)}
                disabled={loading}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Crawl discovered product pages</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Helps when the pasted URL is a category or collection page.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allowFallback}
                onChange={(e) => setAllowFallback(e.target.checked)}
                disabled={loading}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Allow fallback extraction</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Uses lighter fallback parsing when structured product data is missing.
                </span>
              </span>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {resultMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {resultMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !url.trim() || !urlValid}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Importing..." : "Import from URL"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}