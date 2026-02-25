import axios from "axios";
import { tokenStorage } from "./storage";
import { activeTenantStorage } from "./tenantStorage";

export type ApiErrorShape = {
  status: number;
  message: string;
  details?: unknown;
};

/**
 * ApiError extends the built-in Error class to include an HTTP status and
 * optional details. It will be thrown whenever a request returns a non-OK
 * status. Consumers can catch ApiError instances and inspect the status and
 * details to handle errors appropriately (e.g. redirect on 401, display
 * validation messages, etc.).
 */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.status = shape.status;
    this.details = shape.details;
  }
}

/**
 * Options for a request. Mirrored after the older fetch-based wrapper to ease
 * migration. The default method is GET and requests include the bearer
 * Authorization header unless `auth` is explicitly set to false.
 */
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // default true
  signal?: AbortSignal;
};

// Strip trailing slashes from the base URL to avoid double slashes when
// constructing request paths.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

// Create a single Axios instance for the app. We do not attach interceptors
// here; instead we handle token injection and error translation in the api()
// function directly, allowing us to respect the `auth` option per request.
const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

/**
 * Makes an HTTP request using Axios and returns the parsed response data.
 *
 * This function mirrors the signature of the previous fetch-based wrapper and
 * preserves its behaviour: JSON bodies are stringified automatically, the
 * Authorization header is set if `auth` isn’t false, and any non-OK
 * response results in an ApiError. If the backend returns a JSON body with
 * a `detail` property, that value is used as the error message.
 *
 * @param path The endpoint path (e.g. "/auth/me" or "tenants"). Leading slash
 *             is optional.
 * @param opts Optional RequestOptions controlling method, body, headers and auth.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const auth = opts.auth ?? true;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  };

  // Inject bearer token from tokenStorage when auth is enabled.
  if (auth) {
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Inject active tenant header when available (tenant-scoped endpoints)
  const tenantId = activeTenantStorage.get();
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  // Build full URL ensuring a leading slash.
  const url = path.startsWith("/") ? path : `/${path}`;

  try {
    const res = await client.request<T>({
      url,
      method,
      headers,
      data: opts.body,
      signal: opts.signal,
    });
    return res.data;
  } catch (err) {
    // Normalize Axios error into ApiError.
    const error: any = err;
    const response = error.response;
    const status = response?.status ?? 500;
    const payload = response?.data;

    let message: any =
      (payload && typeof payload === "object" && "detail" in payload && payload.detail) ||
      response?.statusText ||
      "Request failed";

    if (typeof message !== "string") {
      message = "Request failed";
    }

    throw new ApiError({ status, message, details: payload });
  }
}

// Optional helper methods for convenience. These simply call the api()
// function with the appropriate HTTP method and return the response body.
export const get = async <T>(path: string, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: "GET" });

export const post = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: "POST", body });

export const put = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: "PUT", body });

export const patch = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: "PATCH", body });

export const del = async <T>(path: string, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: "DELETE" });

/*
 * ============================================================================
 * Domain-specific API helper functions
 *
 * The generic helpers above (`get`, `post`, etc.) are usually sufficient for
 * basic CRUD operations. However, declaring explicit functions for common
 * endpoints improves readability and helps avoid typos in endpoint strings.
 *
 * Adjust the endpoint paths below to match your backend routes.
 */

/**
 * Fetch the list of tenants the current user belongs to.
 */
export const getTenants = async <T = any[]>(): Promise<T> => {
  // Backend route: /api/v1/tenants
  return await get<T>("/api/v1/tenants");
};

/**
 * Create a new tenant.
 */
export const createTenant = async <T = any>(payload: { name: string; [key: string]: any }): Promise<T> => {
  // Backend route: /api/v1/tenants
  return await post<T>("/api/v1/tenants", payload);
};

/**
 * Tenant membership helpers (match your current backend routes)
 * - Membership info: GET /api/v1/tenants/membership  (requires X-Tenant-Id)
 * - Invitations:     GET/POST /api/v1/tenants/invitations (requires X-Tenant-Id + role)
 *
 * NOTE: Your existing helpers were calling /tenants/{id}/members which is NOT
 * in your backend OpenAPI. These are updated to match the backend you showed.
 */

// Get my membership in the currently selected tenant
export const getMyTenantMembership = async <T = any>(): Promise<T> => {
  return await get<T>("/api/v1/tenants/membership");
};

// List invitations for the currently selected tenant (OWNER/ADMIN)
export const listTenantInvitations = async <T = any[]>(): Promise<T> => {
  return await get<T>("/api/v1/tenants/invitations");
};

// Invite a new member to the current tenant (OWNER/ADMIN)
export const inviteTenantMember = async <T = any>(payload: { email: string; role?: string; permissions?: string[] }): Promise<T> => {
  return await post<T>("/api/v1/tenants/invitations", payload);
};

// Remove member endpoint is not present in your current backend routes.
// We'll add it later when the backend supports it.
// export const removeTenantMember = async (memberId: string): Promise<void> => { ... }