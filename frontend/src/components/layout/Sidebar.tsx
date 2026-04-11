// src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useAccess } from "../../hooks/useAccess";

type NavItem = {
  label: string;
  to: string;
  visible: boolean;
};

const NAV_ICONS: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
    </svg>
  ),
  Catalog: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M5 6h6M5 8.5h4M5 11h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  ),
  Members: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M1.5 13c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M11 10.5c1.38.35 2.5 1.5 2.5 3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  ),
  Invitations: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 5.5 8 9.5l6.5-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  ),
  Campaigns: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 10.5 13.5 5 10.5 14 8 10l-6 .5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function mobileNavClass(isActive: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
    isActive
      ? "bg-slate-900 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

function desktopNavClass(isActive: boolean) {
  return [
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
    isActive
      ? "bg-slate-900 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

export default function Sidebar() {
  const { tenantId, can } = useAccess();

  const items: NavItem[] = [
    { label: "Dashboard",   to: "/dashboard",          visible: true },
    { label: "Catalog",     to: "/catalog",             visible: can("catalog.read") },
    { label: "Members",     to: "/tenant-members",      visible: can("tenant.members.read") },
    { label: "Invitations", to: "/tenant-invitations",  visible: can("tenant.invites.manage") },
    { label: "Campaigns",   to: "/campaigns",           visible: true },
  ];

  const visibleItems = items.filter((item) => item.visible);

  return (
    <>
      {/* ── Mobile / tablet nav ────────────────────────────────── */}
      <aside className="border-b border-slate-200 bg-white lg:hidden">
        <div className="px-4 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
              </svg>
            </span>
            <span className="text-xs font-bold tracking-[0.2em] text-slate-800">POSTIKA</span>
          </div>

          {/* Tenant info */}
          {tenantId && (
            <div className="mt-2 truncate rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Tenant:</span>{" "}
              <span className="font-mono">{tenantId.slice(0, 8)}…</span>
            </div>
          )}

          {/* Nav */}
          <nav className="mt-3 overflow-x-auto">
            <div className="flex min-w-max gap-1 pb-0.5">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  <span className="opacity-80">{NAV_ICONS[item.label]}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────── */}
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:w-60 lg:flex-col">
        {/* Brand block */}
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 shadow-sm">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
              </svg>
            </span>
            <span className="text-sm font-bold tracking-[0.18em] text-slate-800">POSTIKA</span>
          </div>

          {/* Tenant pill */}
          <div className="mt-4">
            {tenantId ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Workspace</div>
                <div className="mt-0.5 truncate font-mono text-xs text-slate-700">{tenantId}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                No workspace selected
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4">
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </div>
          <div className="mt-2 space-y-0.5">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => desktopNavClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    {/* Icon inherits currentColor from parent — white when active, slate-400 when not */}
                    <span className={isActive ? "opacity-90" : "text-slate-400"}>
                      {NAV_ICONS[item.label]}
                    </span>
                    {/* Label text is always inherited from parent class (white or slate-600) */}
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="text-[10px] text-slate-400">© {new Date().getFullYear()} Postika</div>
        </div>
      </aside>
    </>
  );
}
