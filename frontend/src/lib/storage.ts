const TOKEN_KEY = "postika_access_token";
const PENDING_EMAIL_KEY = "postika_pending_email";

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export const pendingEmailStorage = {
  get(): string | null {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY);
    } catch {
      return null;
    }
  },
  set(email: string) {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  },
  clear() {
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
  },
};
