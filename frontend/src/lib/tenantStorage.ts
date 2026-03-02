// frontend/src/lib/tenantStorage.ts
const KEY = "postika.activeTenantId";

// Same-tab tenant-change event (React won't re-render from localStorage changes by itself)
export const ACTIVE_TENANT_CHANGED_EVENT = "postika:active-tenant-changed";

function dispatchTenantChanged() {
  try {
    window.dispatchEvent(new Event(ACTIVE_TENANT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export const activeTenantStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(id: string) {
    try {
      localStorage.setItem(KEY, id);
      dispatchTenantChanged();
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      dispatchTenantChanged();
    } catch {
      // ignore
    }
  },
};