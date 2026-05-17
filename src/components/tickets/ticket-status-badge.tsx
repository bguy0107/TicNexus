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
  OPEN: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700",
  ORDERED: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700",
  MONITORING: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700",
  AWAITING_APPROVAL: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900 dark:text-pink-300 dark:border-pink-700",
  APPROVED: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
  PROJECTED: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
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
  IT: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-300 dark:border-cyan-700",
  MAINTENANCE: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700",
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
