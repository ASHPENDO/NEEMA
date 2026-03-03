// frontend/src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { pendingEmailStorage, tokenStorage } from "../lib/storage";
import { activeTenantStorage } from "../lib/tenantStorage";
import { clearTenantMembershipCache } from "../hooks/useTenantMembership";
import type { AuthTokenResponse, MeResponse, UpdateMeRequest } from "./types";

type AuthState = {
  isBootstrapping: boolean;
  isAuthed: boolean;
  token: string | null;
  me: MeResponse | null;
};

type AuthContextValue = AuthState & {
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  updateMe: (payload: UpdateMeRequest) => Promise<void>;
  logout: () => void;
  getPendingEmail: () => string | null;
  setPendingEmail: (email: string) => void;
  clearPendingEmail: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeMe(data: any): MeResponse {
  return {
    ...data,
    name: data?.name ?? data?.full_name ?? null,
    phone_number: data?.phone_number ?? data?.phone_e164 ?? null,
    is_profile_complete:
      typeof data?.is_profile_complete === "boolean"
        ? data.is_profile_complete
        : Boolean(data?.profile_complete),
  } as MeResponse;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const bootstrappedRef = useRef(false);

  const isAuthed = !!token;

  async function refreshMe() {
    if (!tokenStorage.get()) {
      setMe(null);
      return;
    }
    const data = await api<any>("/api/v1/auth/me", { method: "GET", auth: true });
    setMe(normalizeMe(data));
  }

  // 🔴 HARDENED LOGOUT
  function logout() {
    try {
      // Clear all storages
      tokenStorage.clear();
      pendingEmailStorage.clear();
      activeTenantStorage.clear();
      clearTenantMembershipCache();

      // Reset in-memory state
      setToken(null);
      setMe(null);
    } finally {
      // Hard navigation ensures full SPA reset (prevents ghost auth state)
      window.location.assign("/login");
    }
  }

  async function requestCode(email: string) {
    await api("/api/v1/auth/request-code", {
      method: "POST",
      auth: false,
      body: { email },
    });
  }

  async function verifyCode(email: string, code: string) {
    const res = await api<AuthTokenResponse>("/api/v1/auth/verify-code", {
      method: "POST",
      auth: false,
      body: { email, code },
    });

    const accessToken = res.access_token;
    if (!accessToken) throw new Error("Missing access token from server response.");

    tokenStorage.set(accessToken);
    setToken(accessToken);

    await refreshMe();
  }

  async function updateMe(payload: UpdateMeRequest) {
    const updated = await api<any>("/api/v1/auth/me", {
      method: "PATCH",
      auth: true,
      body: payload,
    });
    setMe(normalizeMe(updated));
  }

  function getPendingEmail() {
    return pendingEmailStorage.get();
  }
  function setPendingEmail(email: string) {
    pendingEmailStorage.set(email);
  }
  function clearPendingEmail() {
    pendingEmailStorage.clear();
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        if (tokenStorage.get()) {
          await refreshMe();
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          logout();
        } else {
          console.error(e);
        }
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      isBootstrapping,
      isAuthed,
      token,
      me,
      requestCode,
      verifyCode,
      refreshMe,
      updateMe,
      logout,
      getPendingEmail,
      setPendingEmail,
      clearPendingEmail,
    }),
    [isBootstrapping, isAuthed, token, me]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isProfileComplete(me: MeResponse | null) {
  if (!me) return false;

  const canonical = (me as any).profile_complete;
  if (typeof canonical === "boolean") return canonical;

  if ((me as any).is_profile_complete === true) return true;

  const nameOk = !!((me as any).name && String((me as any).name).trim().length >= 2);
  const phoneOk = !!((me as any).phone_number && String((me as any).phone_number).trim().length >= 8);
  return nameOk && phoneOk;
}