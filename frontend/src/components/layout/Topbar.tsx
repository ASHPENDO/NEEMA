// src/components/layout/Topbar.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../Button";
import { useAuth } from "../../auth/AuthContext";
import { useAccess } from "../../hooks/useAccess";

export default function Topbar() {
  const nav = useNavigate();
  const { logout, me } = useAuth();
  const { tenantId, membership, ready } = useAccess();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">POSTIKA Workspace</div>
          <div className="mt-1 text-xs text-slate-500">
            {tenantId ? (
              <>
                Tenant: <span className="font-medium">{tenantId}</span>
                {" · "}
                Role: <span className="font-medium">{ready ? membership?.role ?? "—" : "Resolving..."}</span>
              </>
            ) : (
              "No active tenant selected"
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!tenantId && (
            <Button variant="secondary" onClick={() => nav("/tenant-selection")}>
              Select workspace
            </Button>
          )}

          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="truncate text-sm font-medium text-slate-900">{me?.name || me?.email || "User"}</div>
            <div className="truncate text-xs text-slate-500">{me?.email || "—"}</div>
          </div>

          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}