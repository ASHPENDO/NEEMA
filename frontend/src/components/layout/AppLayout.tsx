import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const location = useLocation();

  // 🔥 FIX: use token instead of isAuthed
  const { token, isBootstrapping } = useAuth();

  // Wait for auth hydration before making routing decisions
  if (isBootstrapping) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
            padding: "1.25rem 1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <svg
            style={{
              width: 16,
              height: 16,
              animation: "spin 1s linear infinite",
              color: "#94a3b8",
            }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              style={{ opacity: 0.25 }}
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              style={{ opacity: 0.75 }}
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span style={{ fontSize: "0.875rem", color: "#475569" }}>
            Loading workspace…
          </span>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 🔥 CRITICAL FIX:
  // Use token presence (NOT user/isAuthed) to determine authentication
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div style={{ minHeight: "100vh", display: "flex" }}>
        <Sidebar />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Topbar />

          <main
            style={{
              flex: 1,
              margin: "0 auto",
              width: "100%",
              maxWidth: "64rem",
              padding: "1.5rem 1rem",
            }}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}