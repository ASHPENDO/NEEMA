// src/app/routes.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Verify from "../pages/Verify";
import AcceptInvitation from "../pages/AcceptInvitation";
import TenantGate from "../pages/TenantGate";
import TenantSelection from "../pages/TenantSelection";
import TenantMembers from "../pages/TenantMembers";
import TenantCreate from "../pages/TenantCreate";
import TenantInvitations from "../pages/TenantInvitations";
import ProfileCompletion from "../pages/ProfileCompletion";
import Dashboard from "../pages/Dashboard";

import RequirePermissions from "../components/RequirePermissions";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/tenant-gate" replace /> },

  { path: "/login", element: <Login /> },
  { path: "/verify", element: <Verify /> },
  { path: "/accept-invitation", element: <AcceptInvitation /> },

  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },

  // ✅ Members: permission-gated (hard block + redirect)
  {
    path: "/tenant-members",
    element: (
      <RequirePermissions permissions={["tenant.members.read", "tenant.members.write"]}>
        <TenantMembers />
      </RequirePermissions>
    ),
  },

  // ✅ Redirect so manual URL /tenants/membership doesn't 404
  { path: "/tenants/membership", element: <Navigate to="/tenant-members" replace /> },

  { path: "/tenant-create", element: <TenantCreate /> },

  // ✅ Invitations: permission-gated (hard block + redirect)
  {
    path: "/tenant-invitations",
    element: (
      <RequirePermissions permission="tenant.invites.manage">
        <TenantInvitations />
      </RequirePermissions>
    ),
  },

  { path: "/profile-completion", element: <ProfileCompletion /> },
  { path: "/dashboard", element: <Dashboard /> },
]);