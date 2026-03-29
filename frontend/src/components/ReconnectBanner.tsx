// components/ReconnectBanner.tsx

export const ReconnectBanner = ({ account }) => {
  const handleReconnect = async () => {
    const res = await fetch(
      "/api/v1/social-accounts/reconnect/facebook",
      { method: "POST" }
    );

    const data = await res.json();

    window.location.href = data.reconnect_url;
  };

  return (
    <div className="bg-red-100 p-4 rounded-xl">
      <p className="text-red-600 font-medium">
        Facebook connection expired or restricted.
      </p>

      <button
        onClick={handleReconnect}
        className="mt-2 px-4 py-2 bg-black text-white rounded-lg"
      >
        Reconnect Facebook
      </button>
    </div>
  );
};