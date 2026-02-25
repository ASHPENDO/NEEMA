import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Guards nested routes based on the user's auth status.
 * - Shows a loading state while hydrating.
 * - Renders child routes only if the user is authenticated.
 * - Redirects to /login for guests, preserving the intended path.
 */
const ProtectedRoute: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();

  // Show a loading indicator while checking auth (idle or loading state).
  if (status === "idle" || status === "loading") {
    return <div>Loading…</div>;
  }

  // If authenticated, render the nested routes.
  if (status === "authed") {
    return <Outlet />;
  }

  // Otherwise, redirect to login and remember where we came from.
  return <Navigate to="/login" replace state={{ from: location }} />;
};

export default ProtectedRoute;