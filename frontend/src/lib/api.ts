// src/lib/api.ts
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
 * optional details.
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

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // default true
  signal?: AbortSignal;
};

// IMPORTANT: avoid localhost to prevent IPv6/hosts mismatch on some machines.
// If VITE_API_BASE_URL is not set, fall back to 127.0.0.1:8000.
const DEFAULT_DEV_BASE = "http://127.0.0.1:8000";
const rawBase = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_DEV_BASE;
const BASE_URL = String(rawBase).replace(/\/+$/, "");

console.log("[API] BASE_URL =", BASE_URL);

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

function buildHeaders(opts: RequestOptions, contentType?: string): Record<string, string> {
  const auth = opts.auth ?? true;

  const headers: Record<string, string> = {
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(opts.headers ?? {}),
  };

  // Inject bearer token from tokenStorage when auth is enabled (PER REQUEST)
  if (auth) {
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Inject active tenant header when available (tenant-scoped endpoints)
  const tenantId = activeTenantStorage.get();
  if (tenantId) {
    // MUST be UUID only (no "X-Tenant-Id: <uuid>" string)
    headers["X-Tenant-Id"] = tenantId;
  }

  return headers;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";

  const headers = buildHeaders(opts, "application/json");

  // Ensure leading slash
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
    const error: any = err;
    const response = error.response;
    const status = response?.status ?? 500;
    const payload = response?.data;

    let message: any =
      (payload && typeof payload === "object" && "detail" in payload && (payload as any).detail) ||
      response?.statusText ||
      "Request failed";

    if (typeof message !== "string") message = "Request failed";

    throw new ApiError({ status, message, details: payload });
  }
}

/**
 * apiForm: same as api(), but sends multipart/form-data safely.
 * Important: DO NOT set Content-Type here; the browser will set the boundary.
 */
export async function apiForm<T>(path: string, form: FormData, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
  const method = opts.method ?? "POST";

  const headers = buildHeaders({ ...opts }, undefined);

  // Ensure leading slash
  const url = path.startsWith("/") ? path : `/${path}`;

  try {
    const res = await client.request<T>({
      url,
      method,
      headers,
      data: form,
      signal: opts.signal,
    });
    return res.data;
  } catch (err) {
    const error: any = err;
    const response = error.response;
    const status = response?.status ?? 500;
    const payload = response?.data;

    let message: any =
      (payload && typeof payload === "object" && "detail" in payload && (payload as any).detail) ||
      response?.statusText ||
      "Request failed";

    if (typeof message !== "string") message = "Request failed";

    throw new ApiError({ status, message, details: payload });
  }
}

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
 * Catalog / Products (tenant-scoped)
 * Backend paths:
 *   GET    /api/v1/catalog
 *   POST   /api/v1/catalog
 *   PATCH  /api/v1/catalog/{item_id}
 *   DELETE /api/v1/catalog/{item_id}
 *   POST   /api/v1/catalog/bulk
 *   POST   /api/v1/catalog/items/bulk-upload   (ZIP upload)
 * ============================================================================
 */

export type CatalogItem = {
  id: string;
  tenant_id: string;
  name: string;
  sku?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CatalogCreateRequest = {
  name: string;
  sku?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
};

export type CatalogUpdateRequest = Partial<CatalogCreateRequest>;

// GET /api/v1/catalog
export async function listCatalogItems(params?: { q?: string }): Promise<CatalogItem[]> {
  const query = params?.q ? `?q=${encodeURIComponent(params.q)}` : "";
  return await get(`/api/v1/catalog${query}`);
}

// POST /api/v1/catalog
export async function createCatalogItem(payload: CatalogCreateRequest): Promise<CatalogItem> {
  return await post(`/api/v1/catalog`, payload);
}

// PATCH /api/v1/catalog/{id}
export async function updateCatalogItem(itemId: string, payload: CatalogUpdateRequest): Promise<CatalogItem> {
  return await patch(`/api/v1/catalog/${encodeURIComponent(itemId)}`, payload);
}

// DELETE /api/v1/catalog/{id}
export async function deleteCatalogItem(itemId: string): Promise<{ ok: true }> {
  return await del(`/api/v1/catalog/${encodeURIComponent(itemId)}`);
}

// POST /api/v1/catalog/bulk
export async function bulkCreateCatalogItems(items: CatalogCreateRequest[]): Promise<{ created: CatalogItem[] }> {
  return await post(`/api/v1/catalog/bulk`, items);
}

/**
 * ZIP bulk upload:
 * POST /api/v1/catalog/items/bulk-upload
 * Form field: file=<zip>
 */
export async function bulkUploadCatalogZip(
  file: File
): Promise<{ created: any[]; errors?: { folder: string; reason: string }[] }> {
  const form = new FormData();
  form.append("file", file);
  return await apiForm(`/api/v1/catalog/items/bulk-upload`, form, { method: "POST" });
}

/*
 * ============================================================================
 * Domain-specific API helper functions
 * ============================================================================
 */

export const getTenants = async <T = any[]>(): Promise<T> => {
  return await get<T>("/api/v1/tenants");
};

export const createTenant = async <T = any>(payload: { name: string; [key: string]: any }): Promise<T> => {
  return await post<T>("/api/v1/tenants", payload);
};

// Get my membership in the currently selected tenant
export const getMyTenantMembership = async <T = any>(): Promise<T> => {
  return await get<T>("/api/v1/tenants/membership");
};

/*
 * ============================================================================
 * Tenant Invitations
 * Backend paths:
 *   GET  /api/v1/tenant-invitations
 *   POST /api/v1/tenant-invitations
 *   POST /api/v1/tenant-invitations/{invite_id}/revoke
 *   POST /api/v1/tenant-invitations/{invite_id}/resend
 *   POST /api/v1/tenant-invitations/accept
 * ============================================================================
 */

// Align roles to backend enum
export type TenantRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export type TenantInvitation = {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantRole;
  permissions?: string[];
  token?: string;
  expires_at?: string;
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
  invited_by_user_id?: string | null;
  created_at?: string;
};

export type CreateInvitationRequest = {
  email: string;
  role: TenantRole;
  permissions?: string[];
};

// List invitations for the currently selected tenant (OWNER)
export const listTenantInvitations = async <T = TenantInvitation[] | { items: TenantInvitation[] }>(): Promise<T> => {
  return await get<T>("/api/v1/tenant-invitations");
};

// Invite a new member to the current tenant (OWNER)
export const inviteTenantMember = async <T = TenantInvitation>(payload: {
  email: string;
  role?: TenantRole;
  permissions?: string[];
}): Promise<T> => {
  return await post<T>("/api/v1/tenant-invitations", payload);
};

// Strongly-typed alias (same endpoint as inviteTenantMember)
export const createTenantInvitation = async (payload: CreateInvitationRequest): Promise<TenantInvitation> => {
  return await post<TenantInvitation>("/api/v1/tenant-invitations", payload);
};

// Revoke invitation (Swagger uses POST, not DELETE)
export const revokeTenantInvitation = async (inviteId: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/${inviteId}/revoke`);
};

// Resend invitation (Swagger uses POST)
export const resendTenantInvitation = async (inviteId: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/${inviteId}/resend`);
};

// Accept invitation (token-based) — sends accept_tos
export const acceptTenantInvitation = async (token: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/accept`, { token, accept_tos: true });
};

/*
 * ============================================================================
 * Tenant Members (tenant-scoped) — list + manage (OWNER/ADMIN)
 * Backend paths:
 *   GET   /api/v1/tenants/members
 *   PATCH /api/v1/tenants/members/{member_user_id}
 * ============================================================================
 */

export type TenantMember = {
  tenant_id: string;
  user_id: string;
  email: string;
  name?: string | null;
  role: TenantRole;
  permissions: string[];
  is_active: boolean;
  created_at: string;
};

export type UpdateTenantMemberRequest = {
  role?: TenantMember["role"];
  is_active?: boolean;
};

export async function listTenantMembers(): Promise<TenantMember[]> {
  return api<TenantMember[]>("/api/v1/tenants/members", { method: "GET" });
}

export async function updateTenantMember(memberUserId: string, payload: UpdateTenantMemberRequest): Promise<TenantMember> {
  return api<TenantMember>(`/api/v1/tenants/members/${memberUserId}`, {
    method: "PATCH",
    body: payload,
  });
}

// Back-compat alias: older code may import getTenantMembers.
export const getTenantMembers = async <T = TenantMember[]>(): Promise<T> => {
  return (await listTenantMembers()) as unknown as T;
};