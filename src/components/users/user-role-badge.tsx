import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@prisma/client"

const roleColors: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
  FRANCHISE_MANAGER: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
  SUPERVISOR: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700",
  TECHNICIAN: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700",
  STORE_USER: "bg-secondary text-secondary-foreground border-border",
}

export function UserRoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleColors[role]}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}
