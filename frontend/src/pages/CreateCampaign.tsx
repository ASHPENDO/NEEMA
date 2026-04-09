import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../lib/api";

export default function CreateCampaign() {
  const navigate = useNavigate();

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [platform, setPlatform] = useState("facebook");

  const [pageId, setPageId] = useState("");
  const [productId, setProductId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // ==============================
  // LOAD DATA
  // ==============================
  useEffect(() => {
    async function loadAll() {
      try {
        const [tRes, pRes, sRes] = await Promise.all([
          get("/api/v1/templates/"),
          get("/api/v1/catalog/"),
          get("/api/v1/social-accounts/"),
        ]);

        setTemplates(Array.isArray(tRes.data) ? tRes.data : []);
        setProducts(Array.isArray(pRes.data) ? pRes.data : []);
        setPages(Array.isArray(sRes.data) ? sRes.data : []);

      } catch (err) {
        console.error("Failed to load data", err);
      }
    }

    loadAll();
  }, []);

  // ==============================
  // AI GENERATION
  // ==============================
  async function handleGenerateAI() {
    if (!productId || !templateId) {
      alert("Select product and template first");
      return;
    }

    try {
      setAiLoading(true);

      const res = await post("/api/v1/ai/generate", {
        product_id: productId,
        template_id: templateId,
      });

      let data;

      try {
        data =
          typeof res.data.data === "string"
            ? JSON.parse(res.data.data)
            : res.data.data;
      } catch {
        alert("AI returned invalid format");
        return;
      }

      if (!data?.full_caption) {
        alert("AI response missing caption");
        return;
      }

      setCaption(data.full_caption);

    } catch {
      alert("AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  // ==============================
  // SUBMIT
  // ==============================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!caption || !imageUrl || !pageId || !productId || !templateId) {
      alert("Fill all fields");
      return;
    }

    try {
      setLoading(true);

      await post("/api/v1/campaigns", {
        caption,
        media_url: imageUrl,
        platforms: [platform],
        page_ids: [pageId],
        product_id: productId,
        template_id: templateId,
      });

      navigate("/campaigns");
    } catch {
      alert("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Create Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* PRODUCT */}
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {/* TEMPLATE */}
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="">Select Template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* PAGE */}
        <select
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="">Select Page</option>
          {pages.map((p) => (
            <option key={p.id} value={p.page_id}>
              {p.page_id}
            </option>
          ))}
        </select>

        {/* CAPTION */}
        <textarea
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full border rounded p-2"
          disabled={aiLoading}
        />

        {/* IMAGE */}
        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full border rounded p-2"
        />

        {/* AI BUTTON */}
        <button
          type="button"
          onClick={handleGenerateAI}
          disabled={aiLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          {aiLoading ? "Generating..." : "Generate with AI"}
        </button>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 text-white px-4 py-2 rounded w-full"
        >
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </form>
    </div>
  );
}