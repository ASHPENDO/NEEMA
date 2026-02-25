import axios from 'axios';
import { tokenStorage } from './storage';

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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // default true
  signal?: AbortSignal;
};

// Strip trailing slashes from the base URL to avoid double slashes when
// constructing request paths.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

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
  const method = opts.method ?? 'GET';
  const auth = opts.auth ?? true;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };

  // Inject bearer token from tokenStorage when auth is enabled.
  if (auth) {
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Build full URL ensuring a leading slash.
  const url = path.startsWith('/') ? path : `/${path}`;

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
      (payload && typeof payload === 'object' && 'detail' in payload && payload.detail) ||
      response?.statusText ||
      'Request failed';
    if (typeof message !== 'string') {
      message = 'Request failed';
    }
    throw new ApiError({ status, message, details: payload });
  }
}

// Optional helper methods for convenience. These simply call the api()
// function with the appropriate HTTP method and return the response body.
export const get = async <T>(path: string, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: 'GET' });

export const post = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: 'POST', body });

export const put = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: 'PUT', body });

export const patch = async <T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: 'PATCH', body });

export const del = async <T>(path: string, opts: RequestOptions = {}): Promise<T> =>
  api<T>(path, { ...opts, method: 'DELETE' });

/*
 * ============================================================================
 * Domain‑specific API helper functions
 *
 * The generic helpers above (`get`, `post`, etc.) are usually sufficient for
 * basic CRUD operations. However, declaring explicit functions for common
 * endpoints improves readability and helps avoid typos in endpoint strings.
 *
 * Adjust the endpoint paths below to match your backend routes (e.g.
 * `/api/v1/tenants` instead of `/tenants` if your API is versioned). All
 * functions return the response body directly and will throw an ApiError on
 * failure.
 */

/**
 * Fetch the list of tenants the current user belongs to.
 * Returns an array of tenant objects. Replace the generic `any` type with
 * your `Tenant` interface once defined.
 */
export const getTenants = async <T = any[]>(): Promise<T> => {
  return await get<T>('/tenants');
};

/**
 * Create a new tenant. Accepts a payload containing at least a `name`
 * field and returns the newly created tenant. Extend the payload
 * type as needed.
 */
export const createTenant = async <T = any>(payload: { name: string; [key: string]: any }): Promise<T> => {
  return await post<T>('/tenants', payload);
};

/* Membership API helpers */

// Get all members of the currently selected tenant
export const getTenantMembers = async <T = any[]>(): Promise<T> => {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) throw new Error('No active tenant selected');
  return await get<T>(`/tenants/${tenantId}/members`);
};

// Invite a new member to the current tenant
export const inviteTenantMember = async <T = any>(payload: { email: string; role: string }): Promise<T> => {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) throw new Error('No active tenant selected');
  return await post<T>(`/tenants/${tenantId}/members`, payload);
};

// Update the role of an existing member
export const updateTenantMemberRole = async <T = any>(memberId: string, role: string): Promise<T> => {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) throw new Error('No active tenant selected');
  return await patch<T>(`/tenants/${tenantId}/members/${memberId}`, { role });
};

// Remove a member from the current tenant
export const removeTenantMember = async (memberId: string): Promise<void> => {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) throw new Error('No active tenant selected');
  await del<void>(`/tenants/${tenantId}/members/${memberId}`);
};