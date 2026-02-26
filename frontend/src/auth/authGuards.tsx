import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isProfileComplete, useAuth } from "./AuthContext";

export function RequireAuth() {
  const { isBootstrapping, isAuthed } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return null;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireProfileComplete() {
  const { isBootstrapping, me } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return null;
  if (!isProfileComplete(me))
    return <Navigate to="/profile-completion" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const { isBootstrapping, isAuthed } = useAuth();
  if (isBootstrapping) return null;
  if (isAuthed) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}