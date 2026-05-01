import { Badge } from "@/components/ui/badge"
import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@prisma/client"

const roleColors: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-800 border-red-200",
  FRANCHISE_MANAGER: "bg-blue-100 text-blue-800 border-blue-200",
  SUPERVISOR: "bg-purple-100 text-purple-800 border-purple-200",
  TECHNICIAN: "bg-amber-100 text-amber-800 border-amber-200",
  STORE_USER: "bg-slate-100 text-slate-800 border-slate-200",
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
