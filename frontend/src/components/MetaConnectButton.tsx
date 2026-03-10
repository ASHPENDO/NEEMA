import React from "react";

export default function MetaConnectButton() {
  const handleConnectMeta = () => {
    const tenantId = "test-tenant";
    const userId = "test-user";

    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    const connectUrl =
      `${apiBase}/api/v1/social/meta/connect` +
      `?tenant_id=${encodeURIComponent(tenantId)}` +
      `&user_id=${encodeURIComponent(userId)}`;

    window.location.href = connectUrl;
  };

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={handleConnectMeta}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Connect Facebook / Instagram
      </button>
    </div>
  );
}