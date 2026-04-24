/**
 * [SEC-V3.0] Role-Based Access Control (RBAC)
 * Definitions for NEXUS ERP permissions and roles.
 */

export type Role = "SUPERADMIN" | "ADMIN" | "ENGINEER" | "ACCOUNTANT" | "SALES";

export type Permission = 
  | "inventory:view" | "inventory:edit" | "inventory:delete"
  | "sales:view" | "sales:edit" | "sales:delete"
  | "projects:view" | "projects:edit" | "projects:delete"
  | "finance:view" | "finance:edit" | "finance:delete"
  | "users:manage"
  | "settings:manage"
  | "logs:view";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [
    "inventory:view", "inventory:edit", "inventory:delete",
    "sales:view", "sales:edit", "sales:delete",
    "projects:view", "projects:edit", "projects:delete",
    "finance:view", "finance:edit", "finance:delete",
    "users:manage", "settings:manage", "logs:view"
  ],
  ADMIN: [
    "inventory:view", "inventory:edit", "inventory:delete",
    "sales:view", "sales:edit", "sales:delete",
    "projects:view", "projects:edit", "projects:delete",
    "finance:view", "finance:edit", "finance:delete",
    "users:manage", "settings:manage", "logs:view"
  ],
  ENGINEER: [
    "inventory:view", "inventory:edit",
    "projects:view", "projects:edit",
    "logs:view"
  ],
  ACCOUNTANT: [
    "sales:view",
    "finance:view", "finance:edit",
    "logs:view"
  ],
  SALES: [
    "sales:view", "sales:edit",
    "projects:view",
    "inventory:view"
  ]
};

/**
 * Check if a role has a specific permission.
 */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase() as Role;
  const permissions = ROLE_PERMISSIONS[upperRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: string | null | undefined): Permission[] {
  if (!role) return [];
  const upperRole = role.toUpperCase() as Role;
  return ROLE_PERMISSIONS[upperRole] || [];
}
