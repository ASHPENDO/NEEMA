// src/auth/permissions.ts
export type Role = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export type Permission =
  | "tenant.read"
  | "tenant.write"
  | "tenant.members.read"
  | "tenant.members.write"
  | "tenant.invites.manage"
  | "catalog.read"
  | "catalog.write"
  | "catalog.import"
  | "catalog.delete"
  | "publish.read"
  | "publish.write"
  | "publish.schedule"
  | "ads.read"
  | "ads.write"
  | "ads.budgets"
  | "ads.pixels"
  | "inbox.read"
  | "inbox.write"
  | "inbox.assign"
  | "analytics.read"
  | "analytics.export"
  | "attribution.read"
  | "attribution.write"
  | "billing.read"
  | "billing.write"
  | "ai.read"
  | "ai.write"
  | "tenant.*"
  | "catalog.*"
  | "publish.*"
  | "ads.*"
  | "inbox.*"
  | "analytics.*"
  | "attribution.*"
  | "billing.*"
  | "ai.*";

export const ROLE_BASE_PERMISSIONS: Record<Exclude<Role, "OWNER">, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "tenant.*",
    "catalog.*",
    "publish.*",
    "ads.*",
    "inbox.*",
    "analytics.*",
    "attribution.*",
    "billing.*",
    "ai.*",
  ]),
  MANAGER: new Set<Permission>([
    "tenant.read",
    "tenant.members.read",
    "tenant.invites.manage",
    "catalog.*",
    "publish.*",
    "ads.*",
    "inbox.*",
    "analytics.*",
    "attribution.*",
    "ai.*",
    "billing.read",
  ]),
  STAFF: new Set<Permission>([
    "tenant.read",
    "catalog.read",
    "catalog.write",
    "catalog.import",
    "publish.read",
    "inbox.*",
    "analytics.read",
    "ai.read",
  ]),
};

/**
 * Denies always win over grants, including wildcards.
 * - STAFF cannot delete catalog items
 * - ADMIN cannot manage invitations
 */
export const ROLE_DENY_PERMISSIONS: Partial<Record<Role, ReadonlySet<Permission>>> = {
  STAFF: new Set<Permission>(["catalog.delete"]),
  ADMIN: new Set<Permission>(["tenant.invites.manage"]),
};

function hasWildcard(grants: Set<string>, required: string): boolean {
  if (grants.has(required)) return true;

  const idx = required.indexOf(".");
  if (idx <= 0) return false;

  const domain = required.slice(0, idx);
  return grants.has(`${domain}.*`);
}

function effectivePermissions(role: Role, extra?: string[] | null): Set<string> {
  const base =
    role === "OWNER" ? new Set<string>() : new Set<string>(Array.from(ROLE_BASE_PERMISSIONS[role] ?? []));

  if (Array.isArray(extra)) {
    for (const p of extra) {
      if (typeof p === "string" && p.trim()) {
        base.add(p.trim());
      }
    }
  }

  return base;
}

function effectiveDenies(role: Role, denyExtra?: string[] | null): Set<string> {
  const denies = new Set<string>(Array.from(ROLE_DENY_PERMISSIONS[role] ?? []));

  if (Array.isArray(denyExtra)) {
    for (const p of denyExtra) {
      if (typeof p === "string" && p.trim()) {
        denies.add(p.trim());
      }
    }
  }

  return denies;
}

export function hasPermission(meOrMembership: any, perm: Permission | string): boolean {
  const membership =
    meOrMembership?.role
      ? meOrMembership
      : meOrMembership?.membership ?? meOrMembership?.active_membership ?? null;

  const role: Role | undefined = membership?.role;
  if (!role) return false;

  if (role === "OWNER") return true;

  const denies = effectiveDenies(role, membership?.denied_permissions ?? null);
  if (hasWildcard(denies, String(perm))) return false;

  const grants = effectivePermissions(role, membership?.permissions ?? null);
  return hasWildcard(grants, String(perm));
}

// -----------------------------------------------------------------------------
// Catalog helpers
// -----------------------------------------------------------------------------

export function canReadCatalog(me: any): boolean {
  return hasPermission(me, "catalog.read");
}

export function canWriteCatalog(me: any): boolean {
  return hasPermission(me, "catalog.write");
}

export function canImportCatalog(me: any): boolean {
  return hasPermission(me, "catalog.import") || hasPermission(me, "catalog.write");
}

export function canDeleteCatalog(me: any): boolean {
  return hasPermission(me, "catalog.delete");
}

// -----------------------------------------------------------------------------
// Tenant/member helpers
// -----------------------------------------------------------------------------

export function canReadTenantMembers(me: any): boolean {
  return hasPermission(me, "tenant.members.read");
}

export function canManageTenantMembers(me: any): boolean {
  return hasPermission(me, "tenant.members.write");
}

export function canManageTenantInvitations(me: any): boolean {
  return hasPermission(me, "tenant.invites.manage");
}