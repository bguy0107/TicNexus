import type { Role } from "@prisma/client"

type Permission =
  | "franchise:create"
  | "franchise:read:all"
  | "franchise:read:own"
  | "franchise:update"
  | "franchise:delete"
  | "location:create"
  | "location:read:all"
  | "location:read:own"
  | "location:update"
  | "location:delete"
  | "user:create:ADMIN"
  | "user:create:FRANCHISE_MANAGER"
  | "user:create:SUPERVISOR"
  | "user:create:TECHNICIAN"
  | "user:create:STORE_USER"
  | "user:read:all"
  | "user:read:franchise"
  | "user:read:location"
  | "user:update:any"
  | "user:update:below"
  | "user:update:role"
  | "user:update:assignments"
  | "user:deactivate:any"
  | "user:deactivate:below"
  | "user:reactivate:any"
  | "user:reactivate:below"
  | "user:reset-password:any"
  | "user:reset-password:below"
  | "technician:assign"

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "franchise:create",
    "franchise:read:all",
    "franchise:read:own",
    "franchise:update",
    "franchise:delete",
    "location:create",
    "location:read:all",
    "location:read:own",
    "location:update",
    "location:delete",
    "user:create:ADMIN",
    "user:create:FRANCHISE_MANAGER",
    "user:create:SUPERVISOR",
    "user:create:TECHNICIAN",
    "user:create:STORE_USER",
    "user:read:all",
    "user:update:any",
    "user:update:role",
    "user:update:assignments",
    "user:deactivate:any",
    "user:reactivate:any",
    "user:reset-password:any",
    "technician:assign",
  ],
  FRANCHISE_MANAGER: [
    "franchise:read:own",
    "location:create",
    "location:read:own",
    "location:update",
    "user:create:SUPERVISOR",
    "user:create:TECHNICIAN",
    "user:create:STORE_USER",
    "user:read:franchise",
    "user:update:below",
    "user:update:role",
    "user:update:assignments",
    "user:deactivate:below",
    "user:reactivate:below",
    "user:reset-password:below",
    "technician:assign",
  ],
  SUPERVISOR: [
    "franchise:read:own",
    "location:read:own",
    "user:create:STORE_USER",
    "user:read:location",
    "user:update:below",
    "user:update:assignments",
    "user:deactivate:below",
    "user:reactivate:below",
    "user:reset-password:below",
  ],
  TECHNICIAN: ["franchise:read:own", "location:read:own", "user:read:location"],
  STORE_USER: ["location:read:own", "user:read:location"],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function canCreateRole(creatorRole: Role, targetRole: Role): boolean {
  const perm = `user:create:${targetRole}` as Permission
  return ROLE_PERMISSIONS[creatorRole].includes(perm)
}

const ROLE_RANK: Record<Role, number> = {
  ADMIN: 5,
  FRANCHISE_MANAGER: 4,
  SUPERVISOR: 3,
  TECHNICIAN: 2,
  STORE_USER: 1,
}

export function isHigherRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole]
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    ADMIN: "Admin",
    FRANCHISE_MANAGER: "Franchise Manager",
    SUPERVISOR: "Supervisor",
    TECHNICIAN: "Technician",
    STORE_USER: "Store User",
  }
  return labels[role]
}
