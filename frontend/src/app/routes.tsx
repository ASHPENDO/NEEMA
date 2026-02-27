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

import TenantRoleGuard from "../components/TenantRoleGuard";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/tenant-gate" replace /> },

  { path: "/login", element: <Login /> },
  { path: "/verify", element: <Verify /> },
  { path: "/accept-invitation", element: <AcceptInvitation /> },

  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },

  // ✅ Members: OWNER/ADMIN only
  {
    path: "/tenant-members",
    element: (
      <TenantRoleGuard allow={["OWNER", "ADMIN"]}>
        <TenantMembers />
      </TenantRoleGuard>
    ),
  },

  // ✅ Redirect so manual URL /tenants/membership doesn't 404
  { path: "/tenants/membership", element: <Navigate to="/tenant-members" replace /> },

  { path: "/tenant-create", element: <TenantCreate /> },

  // ✅ Invitations: OWNER/ADMIN only
  {
    path: "/tenant-invitations",
    element: (
      <TenantRoleGuard allow={["OWNER", "ADMIN"]}>
        <TenantInvitations />
      </TenantRoleGuard>
    ),
  },

  { path: "/profile-completion", element: <ProfileCompletion /> },
  { path: "/dashboard", element: <Dashboard /> },
]);