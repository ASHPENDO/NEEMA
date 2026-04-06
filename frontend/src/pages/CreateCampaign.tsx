import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function CreateCampaign() {
  const navigate = useNavigate();

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [pageId, setPageId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!caption || !imageUrl || !platform || !pageId) {
      alert("All fields are required");
      return;
    }

    try {
      setLoading(true);

      await api.post("/campaigns/", {
        caption,
        image_url: imageUrl,
        platforms: [platform],
        page_ids: [pageId],
      });

      navigate("/campaigns");
    } catch (error) {
      console.error("CreateCampaign error:", error);
      alert("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Create Campaign</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-2xl p-5 space-y-4"
      >
        <div>
          <label className="text-sm font-medium">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            rows={3}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Image URL</label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          >
            <option value="facebook">Facebook</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Page ID</label>
          <input
            type="text"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            placeholder="1097989406733639"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-800"
        >
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </form>
    </div>
  );
}