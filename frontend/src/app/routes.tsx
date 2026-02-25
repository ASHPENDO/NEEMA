// src/app/routes.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import TenantGate from "../pages/TenantGate";
import TenantSelection from "../pages/TenantSelection";
import TenantMembers from "../pages/TenantMembers";

// Temporary placeholder dashboard (replace later)
const Dashboard = () => (
  <div style={{ padding: 16 }}>Dashboard</div>
);

// Temporary placeholder tenant create (replace later)
const TenantCreate = () => (
  <div style={{ padding: 16 }}>Tenant Create</div>
);

// Temporary placeholder profile completion
const ProfileCompletion = () => (
  <div style={{ padding: 16 }}>Profile Completion</div>
);

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/tenant-gate" replace /> },

  { path: "/login", element: <Login /> },
  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },
  { path: "/tenant-members", element: <TenantMembers /> },
  { path: "/tenant-create", element: <TenantCreate /> },
  { path: "/profile-completion", element: <ProfileCompletion /> },
  { path: "/dashboard", element: <Dashboard /> },
]);