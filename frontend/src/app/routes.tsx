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

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/tenant-gate" replace /> },

  { path: "/login", element: <Login /> },
  { path: "/verify", element: <Verify /> },
  { path: "/accept-invitation", element: <AcceptInvitation /> },

  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },

  // ✅ Real members route
  { path: "/tenant-members", element: <TenantMembers /> },

  // ✅ Redirect so manual URL /tenants/membership works
  { path: "/tenants/membership", element: <Navigate to="/tenant-members" replace /> },

  { path: "/tenant-create", element: <TenantCreate /> },
  { path: "/tenant-invitations", element: <TenantInvitations /> },

  { path: "/profile-completion", element: <ProfileCompletion /> },
  { path: "/dashboard", element: <Dashboard /> },
]);