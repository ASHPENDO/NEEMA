import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Verify from "../pages/Verify";
import AcceptInvitation from "../pages/AcceptInvitation";

import TenantGate from "../pages/TenantGate";
import TenantSelection from "../pages/TenantSelection";
import TenantCreate from "../pages/TenantCreate";
import ProfileCompletion from "../pages/ProfileCompletion";

import Dashboard from "../pages/Dashboard";
import Catalog from "../pages/Catalog";
import TenantMembers from "../pages/TenantMembers";
import TenantInvitations from "../pages/TenantInvitations";

import CampaignList from "../pages/CampaignList";
import CampaignDetail from "../pages/CampaignDetail";
import CreateCampaign from "../pages/CreateCampaign";

import RequirePermissions from "../components/RequirePermissions";
import AppLayout from "../components/layout/AppLayout";

export const router = createBrowserRouter([
  // Root → login (AppLayout will redirect authed users to dashboard via its own guard,
  // and unauthenticated users see login. This breaks the /tenant-gate loop.)
  { path: "/", element: <Navigate to="/login" replace /> },

  // ── Public auth routes ─────────────────────────────────────────────────────
  { path: "/login",              element: <Login /> },
  { path: "/verify",             element: <Verify /> },
  { path: "/accept-invitation",  element: <AcceptInvitation /> },

  // ── Onboarding routes (self-guarded inside each page) ─────────────────────
  { path: "/tenant-gate",        element: <TenantGate /> },
  { path: "/tenant-selection",   element: <TenantSelection /> },
  { path: "/tenant-create",      element: <TenantCreate /> },
  { path: "/profile-completion", element: <ProfileCompletion /> },

  // ── Authenticated app routes ───────────────────────────────────────────────
  {
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },

      {
        path: "/catalog",
        element: (
          <RequirePermissions permission="catalog.read">
            <Catalog />
          </RequirePermissions>
        ),
      },
      {
        path: "/tenant-members",
        element: (
          <RequirePermissions permission="tenant.members.read">
            <TenantMembers />
          </RequirePermissions>
        ),
      },
      {
        path: "/tenant-invitations",
        element: (
          <RequirePermissions permission="tenant.invites.manage">
            <TenantInvitations />
          </RequirePermissions>
        ),
      },
      { path: "/campaigns",        element: <CampaignList /> },
      { path: "/campaigns/create", element: <CreateCampaign /> },
      { path: "/campaigns/:id",    element: <CampaignDetail /> },
    ],
  },
]);