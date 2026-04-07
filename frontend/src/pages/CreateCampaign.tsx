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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await get("/api/v1/templates/");

        // 🔍 DEBUG LOGS
        console.log("TEMPLATES RAW RESPONSE:", res);
        console.log("TEMPLATES DATA:", res?.data);

        // ✅ SAFE PARSING (handles different API shapes)
        const data = res?.data || res;

        if (Array.isArray(data)) {
          setTemplates(data);
        } else {
          console.error("Templates response is not an array:", data);
          setTemplates([]);
        }
      } catch (err) {
        console.error("Failed to load templates", err);
      }
    }

    loadTemplates();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanCaption = caption.trim();
    const cleanImageUrl = imageUrl.trim();
    const cleanPageId = pageId.trim();
    const cleanProductId = productId.trim();
    const cleanTemplateId = templateId.trim();

    if (!cleanCaption || !cleanImageUrl || !cleanPageId || !cleanProductId || !cleanTemplateId) {
      alert("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        caption: cleanCaption,
        media_url: cleanImageUrl,
        platforms: [platform.toLowerCase()],
        page_ids: [cleanPageId],
        product_id: cleanProductId,
        template_id: cleanTemplateId,
      };

      console.log("PAYLOAD:", payload);

      await post("/api/v1/campaigns", payload);

      navigate("/campaigns");
    } catch (err: any) {
      console.error("FULL ERROR:", err);
      console.error("RESPONSE:", err?.response);

      if (err?.response?.data) {
        alert(JSON.stringify(err.response.data, null, 2));
      } else {
        alert("Failed to create campaign");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Create Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full border rounded p-2"
        />

        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full border rounded p-2"
        />

        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="facebook">Facebook</option>
        </select>

        <input
          placeholder="Page ID"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          className="w-full border rounded p-2"
        />

        <input
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full border rounded p-2"
        />

        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="">Select Template</option>

          {templates && templates.length > 0 ? (
            templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))
          ) : (
            <option disabled>Loading templates...</option>
          )}
        </select>

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 text-white px-4 py-2 rounded"
        >
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </form>
    </div>
  );
}