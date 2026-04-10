import { useState, useEffect } from "react";
import { post } from "../lib/api";

type AIResult = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  full_caption: string;
};

type Props = {
  result: AIResult;
  onChange: (updated: AIResult) => void;
  // ✅ Multi-product support
  productId?: string;
  productIds?: string[];
};

export default function AIResultEditor({
  result,
  onChange,
  productId,
  productIds,
}: Props) {
  const [hook, setHook]         = useState(result.hook     ?? "");
  const [body, setBody]         = useState(result.body     ?? "");
  const [cta, setCta]           = useState(result.cta      ?? "");
  const [hashtags, setHashtags] = useState(
    Array.isArray(result.hashtags) ? result.hashtags.join(" ") : ""
  );

  // ✅ Track which section is regenerating
  const [loadingSection, setLoadingSection] = useState<"hook" | "body" | "cta" | null>(null);

  // ✅ Sync when parent passes a fresh result (e.g. full regenerate)
  useEffect(() => {
    setHook(result.hook     ?? "");
    setBody(result.body     ?? "");
    setCta(result.cta       ?? "");
    setHashtags(Array.isArray(result.hashtags) ? result.hashtags.join(" ") : "");
  }, [result.full_caption]); // re-sync when a new full caption arrives

  // ✅ Rebuild full_caption automatically on any field change
  useEffect(() => {
    const updated: AIResult = {
      hook,
      body,
      cta,
      hashtags: hashtags.split(" ").filter(Boolean),
      full_caption: [hook, body, cta, hashtags].filter(Boolean).join("\n\n"),
    };
    onChange(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook, body, cta, hashtags]);

  // ✅ Per-section regeneration
  async function regenerate(section: "hook" | "body" | "cta") {
    try {
      setLoadingSection(section);

      const raw = await post<unknown>("/api/v1/ai/regenerate", {
        product_id:  productId,
        product_ids: productIds,
        section,
        context: { hook, body, cta },
      });

      // Unwrap { success, data: { ... } } envelope if present
      const data: Record<string, string> =
        (raw && typeof raw === "object" && (raw as any).data)
          ? (raw as any).data
          : (raw as Record<string, string>);

      if (section === "hook" && data.hook) setHook(data.hook);
      if (section === "body" && data.body) setBody(data.body);
      if (section === "cta"  && data.cta)  setCta(data.cta);
    } catch (err) {
      console.error("Regenerate failed", err);
      alert("Regeneration failed. Please try again.");
    } finally {
      setLoadingSection(null);
    }
  }

  // ── Shared input styles ────────────────────────────────────────────────────
  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const regenBtn = (section: "hook" | "body" | "cta") => (
    <button
      type="button"
      onClick={() => regenerate(section)}
      disabled={loadingSection !== null}
      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold disabled:opacity-40 flex items-center gap-1 transition"
    >
      {loadingSection === section ? (
        <>
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Regenerating…
        </>
      ) : (
        "🔄 Regenerate"
      )}
    </button>
  );

  return (
    <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">

      {/* HOOK */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-gray-700">Hook</label>
          {regenBtn("hook")}
        </div>
        <input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          className={inputCls}
          placeholder="Opening line that grabs attention…"
        />
      </div>

      {/* BODY */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-gray-700">Body</label>
          {regenBtn("body")}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${inputCls} h-28 resize-y`}
          placeholder="Product details, benefits, offer…"
        />
      </div>

      {/* CTA */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-gray-700">Call to Action</label>
          {regenBtn("cta")}
        </div>
        <input
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          className={inputCls}
          placeholder="DM now, Call us, Order today…"
        />
      </div>

      {/* HASHTAGS */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Hashtags</label>
        <input
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          className={inputCls}
          placeholder="#sale #kenya #deals"
        />
        <p className="text-xs text-gray-400 mt-1">Space-separated hashtags</p>
      </div>

      {/* LIVE PREVIEW */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
          Live Preview
        </p>
        <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
          {[hook, body, cta, hashtags].filter(Boolean).join("\n\n") || "Caption will appear here…"}
        </pre>
      </div>
    </div>
  );
}
