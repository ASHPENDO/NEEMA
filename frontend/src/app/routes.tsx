// src/app/routes.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Verify from "../pages/Verify";
import AcceptInvitation from "../pages/AcceptInvitation"; // ✅ added
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
  { path: "/accept-invitation", element: <AcceptInvitation /> }, // ✅ added (entry route)

  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },
  { path: "/tenant-members", element: <TenantMembers /> },
  { path: "/tenant-create", element: <TenantCreate /> },
  { path: "/tenant-invitations", element: <TenantInvitations /> },

  { path: "/profile-completion", element: <ProfileCompletion /> },
  { path: "/dashboard", element: <Dashboard /> },
]);