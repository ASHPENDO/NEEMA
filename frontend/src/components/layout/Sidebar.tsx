// src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useAccess } from "../../hooks/useAccess";

type NavItem = {
  label: string;
  to: string;
  visible: boolean;
};

function navClass(isActive: boolean) {
  return [
    "inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition whitespace-nowrap",
    isActive
      ? "bg-slate-900 text-white"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900",
  ].join(" ");
}

function desktopNavClass(isActive: boolean) {
  return [
    "flex items-center rounded-xl px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-slate-900 text-white"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

export default function Sidebar() {
  const { tenantId, can } = useAccess();

  const items: NavItem[] = [
    { label: "Dashboard", to: "/dashboard", visible: true },
    { label: "Catalog", to: "/catalog", visible: can("catalog.read") },
    { label: "Members", to: "/tenant-members", visible: can("tenant.members.read") },
    { label: "Invitations", to: "/tenant-invitations", visible: can("tenant.invites.manage") },
  ];

  const visibleItems = items.filter((item) => item.visible);

  return (
    <>
      {/* Mobile / tablet nav */}
      <aside className="border-b border-slate-200 bg-white lg:hidden">
        <div className="px-4 py-4">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">POSTIKA</div>

          <div className="mt-2 text-sm text-slate-700">
            {tenantId ? (
              <>
                <div className="font-medium text-slate-900">Workspace active</div>
                <div className="mt-1 break-all text-xs text-slate-500">{tenantId}</div>
              </>
            ) : (
              <span className="text-slate-500">No active workspace</span>
            )}
          </div>

          <nav className="mt-4 overflow-x-auto">
            <div className="flex min-w-max gap-2 pb-1">
              {visibleItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:w-64 lg:flex-col">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">POSTIKA</div>

          <div className="mt-3 text-sm text-slate-700">
            {tenantId ? (
              <>
                <div className="font-medium text-slate-900">Workspace active</div>
                <div className="mt-1 break-all text-xs text-slate-500">{tenantId}</div>
              </>
            ) : (
              <span className="text-slate-500">No active workspace</span>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => desktopNavClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}