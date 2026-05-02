import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@prisma/client"

const roleColors: Record<Role, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  FRANCHISE_MANAGER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SUPERVISOR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  TECHNICIAN: "bg-amber-500/20 text-amber-400 border-amber-500/30",
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
