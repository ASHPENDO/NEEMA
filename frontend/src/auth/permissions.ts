export type Role = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export type Permission =
  | "tenant.read" | "tenant.write" | "tenant.members.read" | "tenant.members.write" | "tenant.invites.manage"
  | "catalog.read" | "catalog.write" | "catalog.import"
  | "publish.read" | "publish.write" | "publish.schedule"
  | "ads.read" | "ads.write" | "ads.budgets" | "ads.pixels"
  | "inbox.read" | "inbox.write" | "inbox.assign"
  | "analytics.read" | "analytics.export"
  | "attribution.read" | "attribution.write"
  | "billing.read" | "billing.write"
  | "ai.read" | "ai.write"
  | "tenant.*" | "catalog.*" | "publish.*" | "ads.*" | "inbox.*" | "analytics.*" | "attribution.*" | "billing.*" | "ai.*";

export const ROLE_BASE_PERMISSIONS: Record<Exclude<Role, "OWNER">, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "tenant.*","catalog.*","publish.*","ads.*","inbox.*","analytics.*","attribution.*","billing.*","ai.*",
  ]),
  MANAGER: new Set<Permission>([
    "tenant.read","tenant.members.read","tenant.invites.manage",
    "catalog.*","publish.*","ads.*","inbox.*","analytics.*","attribution.*","ai.*",
    "billing.read",
  ]),
  STAFF: new Set<Permission>([
    "tenant.read","catalog.read","publish.read","inbox.*","analytics.read","ai.read",
  ]),
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
      if (typeof p === "string" && p.trim()) base.add(p.trim());
    }
  }
  return base;
}

export function hasPermission(meOrMembership: any, perm: Permission | string): boolean {
  const membership =
    meOrMembership?.role
      ? meOrMembership
      : meOrMembership?.membership ?? meOrMembership?.active_membership ?? null;

  const role: Role | undefined = membership?.role;
  if (!role) return false;

  if (role === "OWNER") return true;

  const grants = effectivePermissions(role, membership?.permissions ?? null);
  return hasWildcard(grants, perm);
}