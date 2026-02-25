import React from "react";
import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/Login";
import Verify from "../pages/Verify";
import ProfileCompletion from "../pages/ProfileCompletion";
import Dashboard from "../pages/Dashboard";
import TenantSelection from "../pages/TenantSelection";
import TenantMembers from "../pages/TenantMembers";
import { GuestOnly, RequireAuth, RequireProfileComplete } from "../auth/authGuards";

// Define the application router with nested route guards:
// - GuestOnly pages are accessible without authentication.
// - RequireAuth pages require a valid login.
// - RequireProfileComplete pages require both login and a completed profile.
export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: "/", element: <Login /> },
      { path: "/login", element: <Login /> },
      { path: "/verify", element: <Verify /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/complete-profile", element: <ProfileCompletion /> },
      { path: "/tenants", element: <TenantSelection /> }, // Tenant selection/creation page
      {
        element: <RequireProfileComplete />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/members", element: <TenantMembers /> }, // Membership management page
          // other protected routes…
        ],
      },
    ],
  },
]);