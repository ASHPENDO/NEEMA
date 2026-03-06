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
  auth?: boolean;
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

  if (auth) {
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const tenantId = activeTenantStorage.get();
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  return headers;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers = buildHeaders(opts, "application/json");
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
export async function apiForm<T>(
  path: string,
  form: FormData,
  opts: Omit<RequestOptions, "body"> = {}
): Promise<T> {
  const method = opts.method ?? "POST";
  const headers = buildHeaders({ ...opts }, undefined);
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
 *   GET    /api/v1/catalog/items
 *   POST   /api/v1/catalog/items
 *   GET    /api/v1/catalog/items/{item_id}
 *   PATCH  /api/v1/catalog/items/{item_id}
 *   DELETE /api/v1/catalog/items/{item_id}
 *   POST   /api/v1/catalog/items/bulk-upload
 *   POST   /api/v1/catalog/items/scrape
 * ============================================================================
 */

export type CatalogItem = {
  id: string;
  tenant_id: string;
  created_by_user_id?: string | null;
  title: string;
  sku?: string | null;
  description?: string | null;
  price_amount: string;
  price_currency: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CatalogCreateRequest = {
  title: string;
  sku?: string | null;
  description?: string | null;
  price_amount: number | string;
  price_currency?: string;
};

export type CatalogUpdateRequest = {
  title?: string;
  sku?: string | null;
  description?: string | null;
  price_amount?: number | string;
  price_currency?: string;
  status?: string;
};

export async function listCatalogItems(): Promise<CatalogItem[]> {
  return await get("/api/v1/catalog/items");
}

export async function createCatalogItem(payload: CatalogCreateRequest): Promise<CatalogItem> {
  return await post("/api/v1/catalog/items", payload);
}

export async function updateCatalogItem(itemId: string, payload: CatalogUpdateRequest): Promise<CatalogItem> {
  return await patch(`/api/v1/catalog/items/${encodeURIComponent(itemId)}`, payload);
}

export async function deleteCatalogItem(itemId: string): Promise<void> {
  await del(`/api/v1/catalog/items/${encodeURIComponent(itemId)}`);
}

export async function bulkUploadCatalogZip(
  file: File
): Promise<{ created: CatalogItem[]; errors?: { folder: string; reason: string }[] }> {
  const form = new FormData();
  form.append("file", file);
  return await apiForm("/api/v1/catalog/items/bulk-upload", form, { method: "POST" });
}

export type CatalogScrapeRequest = {
  url: string;
  max_items?: number;
  default_currency?: string;
  try_woocommerce_store_api?: boolean;
  crawl_product_pages?: boolean;
  max_product_pages?: number;
  try_shopify_product_json?: boolean;
  allow_fallback?: boolean;
  fallback_price_amount?: string | number | null;
  fallback_price_currency?: string | null;
};

export type CatalogScrapeResponse = {
  source_url: string;
  created: CatalogItem[];
  skipped: number;
  mode_used: string;
  discovered_product_links: number;
  fetched_product_pages: number;
  blocked: boolean;
  blocked_status_code?: number | null;
  blocked_hint?: string | null;
};

export async function scrapeCatalogItems(
  payload: CatalogScrapeRequest
): Promise<CatalogScrapeResponse> {
  return await post("/api/v1/catalog/items/scrape", payload);
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

export const getMyTenantMembership = async <T = any>(): Promise<T> => {
  return await get<T>("/api/v1/tenants/membership");
};

/*
 * ============================================================================
 * Tenant Invitations
 * ============================================================================
 */

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

export const listTenantInvitations = async <T = TenantInvitation[] | { items: TenantInvitation[] }>(): Promise<T> => {
  return await get<T>("/api/v1/tenant-invitations");
};

export const inviteTenantMember = async <T = TenantInvitation>(payload: {
  email: string;
  role?: TenantRole;
  permissions?: string[];
}): Promise<T> => {
  return await post<T>("/api/v1/tenant-invitations", payload);
};

export const createTenantInvitation = async (payload: CreateInvitationRequest): Promise<TenantInvitation> => {
  return await post<TenantInvitation>("/api/v1/tenant-invitations", payload);
};

export const revokeTenantInvitation = async (inviteId: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/${inviteId}/revoke`);
};

export const resendTenantInvitation = async (inviteId: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/${inviteId}/resend`);
};

export const acceptTenantInvitation = async (token: string): Promise<void> => {
  await post(`/api/v1/tenant-invitations/accept`, { token, accept_tos: true });
};

/*
 * ============================================================================
 * Tenant Members
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

export const getTenantMembers = async <T = TenantMember[]>(): Promise<T> => {
  return (await listTenantMembers()) as unknown as T;
};