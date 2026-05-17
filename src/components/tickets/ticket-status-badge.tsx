import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Department, TicketStatus } from "@/types"

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ORDERED: "Ordered",
  MONITORING: "Monitoring",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  PROJECTED: "Projected",
  CLOSED: "Closed",
}

const STATUS_CLASSES: Record<TicketStatus, string> = {
  OPEN: "bg-red-300 text-red-900 border-red-500 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
  IN_PROGRESS:
    "bg-amber-300 text-amber-900 border-amber-500 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700",
  ORDERED:
    "bg-yellow-300 text-yellow-900 border-yellow-500 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700",
  MONITORING:
    "bg-purple-300 text-purple-900 border-purple-500 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700",
  AWAITING_APPROVAL:
    "bg-pink-300 text-pink-900 border-pink-500 dark:bg-pink-900 dark:text-pink-300 dark:border-pink-700",
  APPROVED:
    "bg-green-300 text-green-900 border-green-500 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
  PROJECTED:
    "bg-blue-300 text-blue-900 border-blue-500 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
  CLOSED:
    "bg-slate-300 text-slate-900 border-slate-500 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium whitespace-nowrap", STATUS_CLASSES[status])}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const DEPARTMENT_LABELS: Record<Department, string> = {
  IT: "IT",
  MAINTENANCE: "Maintenance",
}

const DEPARTMENT_CLASSES: Record<Department, string> = {
  IT: "bg-cyan-300 text-cyan-900 border-cyan-500 dark:bg-cyan-900 dark:text-cyan-300 dark:border-cyan-700",
  MAINTENANCE:
    "bg-orange-300 text-orange-900 border-orange-500 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700",
}

export function TicketDepartmentBadge({ department }: { department: Department }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium whitespace-nowrap", DEPARTMENT_CLASSES[department])}
    >
      {DEPARTMENT_LABELS[department]}
    </Badge>
  )
}
