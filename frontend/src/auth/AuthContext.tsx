import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { pendingEmailStorage, tokenStorage } from "../lib/storage";
import { activeTenantStorage } from "../lib/tenantStorage";
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

/**
 * Normalize /auth/me payload for backward compatibility.
 * Backend canonical fields: full_name, phone_e164, profile_complete
 * Older UI fields: name, phone_number, is_profile_complete
 */
function normalizeMe(data: any): MeResponse {
  return {
    ...data,
    // Provide aliases so older UI code keeps working
    name: data?.name ?? data?.full_name ?? null,
    phone_number: data?.phone_number ?? data?.phone_e164 ?? null,
    // Keep legacy boolean in sync if present in types/UI
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

  function logout() {
    tokenStorage.clear();
    activeTenantStorage.clear();
    setToken(null);
    setMe(null);
    // keep pending email optional; many apps keep it for convenience
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

    // Immediately hydrate /me
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

  // Bootstrap once on app start: if token exists, fetch /me; if 401/403, logout.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        if (tokenStorage.get()) {
          await refreshMe();
        }
      } catch (e) {
        // If token is invalid/expired, clear it.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          logout();
        } else {
          console.error(e);
        }
      } finally {
        setIsBootstrapping(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// Helper: profile completeness (use backend truth; robust across schema changes)
export function isProfileComplete(me: MeResponse | null) {
  if (!me) return false;

  // Prefer canonical backend flag
  const canonical = (me as any).profile_complete;
  if (typeof canonical === "boolean") return canonical;

  // Back-compat legacy flag
  if ((me as any).is_profile_complete === true) return true;

  // Last-resort fallback (older UI fields)
  const nameOk = !!((me as any).name && String((me as any).name).trim().length >= 2);
  const phoneOk = !!((me as any).phone_number && String((me as any).phone_number).trim().length >= 8);
  return nameOk && phoneOk;
}