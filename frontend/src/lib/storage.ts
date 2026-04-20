// src/lib/storage.ts

const TOKEN_KEY = "postika_access_token";
const PENDING_EMAIL_KEY = "postika_pending_email";

// ─────────────────────────────────────────────────────────────
// Token Storage
// ─────────────────────────────────────────────────────────────

export const tokenStorage = {
  get(): string | null {
    try {
      const value = localStorage.getItem(TOKEN_KEY);
      return value && value.trim().length > 0 ? value : null;
    } catch {
      return null;
    }
  },

  set(token: string): void {
    try {
      if (!token || typeof token !== "string") return;
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Pending Email Storage
// ─────────────────────────────────────────────────────────────
// Uses localStorage (not sessionStorage) so that the pending email
// survives Codespaces port-based navigation, which can wipe sessionStorage.
// This is cleared immediately after verification.

export const pendingEmailStorage = {
  get(): string | null {
    try {
      const value = localStorage.getItem(PENDING_EMAIL_KEY);
      return value && value.trim().length > 0 ? value : null;
    } catch {
      return null;
    }
  },

  set(email: string): void {
    try {
      if (!email || typeof email !== "string") return;
      localStorage.setItem(PENDING_EMAIL_KEY, email);
    } catch {
      // ignore
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      // ignore
    }
  },
};