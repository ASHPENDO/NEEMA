import React from "react";
import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/Login";
import Verify from "../pages/Verify";
import ProfileCompletion from "../pages/ProfileCompletion";
import Dashboard from "../pages/Dashboard";
import { GuestOnly, RequireAuth, RequireProfileComplete } from "../auth/authGuards";

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
      {
        element: <RequireProfileComplete />,
        children: [{ path: "/dashboard", element: <Dashboard /> }],
      },
    ],
  },
]);
