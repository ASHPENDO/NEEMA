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
import CreateCampaign from "../pages/CreateCampaign"; // ✅ NEW

import RequirePermissions from "../components/RequirePermissions";
import AppLayout from "../components/layout/AppLayout";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/tenant-gate" replace /> },

  { path: "/login", element: <Login /> },
  { path: "/verify", element: <Verify /> },
  { path: "/accept-invitation", element: <AcceptInvitation /> },

  { path: "/tenant-gate", element: <TenantGate /> },
  { path: "/tenant-selection", element: <TenantSelection /> },
  { path: "/tenant-create", element: <TenantCreate /> },
  { path: "/profile-completion", element: <ProfileCompletion /> },

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

      {
        path: "/campaigns",
        element: <CampaignList />,
      },

      {
        path: "/campaigns/create", // ✅ NEW
        element: <CreateCampaign />,
      },

      {
        path: "/campaigns/:id",
        element: <CampaignDetail />,
      },
    ],
  },
]);