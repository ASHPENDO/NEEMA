// src/components/templates/TemplatePreview.tsx

import React, { useMemo, useState } from "react";
import type { CatalogItem } from "../../lib/api";
import { templates } from "../../lib/templates";
import { Button } from "../Button";

type Props = {
  product: CatalogItem | null;
  allProducts: CatalogItem[];
};

export default function TemplatePreview({ product, allProducts }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);

  /* ✅ NEW: copy feedback */
  const [copied, setCopied] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [selectedTemplateId]
  );

  const generated = useMemo(() => {
    if (!product || !selectedTemplate) return null;
    return selectedTemplate.generate(product, allProducts);
  }, [product, selectedTemplate, allProducts]);

  /* ✅ UPDATED COPY LOGIC */
  function handleCopy() {
    if (!generated?.caption) return;

    const text = generated.caption;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => showCopied())
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
      showCopied();
    } catch (err) {
      console.error("Copy failed", err);
    }

    document.body.removeChild(textarea);
  }

  function showCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!product) {
    return (
      <div className="p-4 border rounded-xl text-sm opacity-70">
        Select a product to generate content
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-2xl space-y-4 bg-white">

      {/* Header */}
      <div>
        <div className="text-lg font-semibold">Generate Post</div>
        <div className="text-sm opacity-70">
          {product.title}
        </div>
      </div>

      {/* Template Selector */}
      <div>
        <div className="text-xs mb-1 opacity-70">Template</div>
        <select
          className="w-full border rounded-lg p-2 text-sm"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Caption Preview */}
      <div>
        <div className="text-xs mb-1 opacity-70">Caption</div>
        <div className="border rounded-xl p-3 text-sm whitespace-pre-wrap bg-gray-50">
          {generated?.caption || "No preview available"}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={handleCopy}>
          {copied ? "Copied!" : "Copy Caption"}
        </Button>
      </div>

    </div>
  );
}