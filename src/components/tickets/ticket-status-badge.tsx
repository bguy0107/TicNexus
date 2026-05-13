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
  OPEN: "bg-red-500/10 text-red-400 border-red-500/20",
  IN_PROGRESS: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ORDERED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  MONITORING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  AWAITING_APPROVAL: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  APPROVED: "bg-white/10 text-white border-white/20",
  PROJECTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CLOSED: "bg-green-500/10 text-green-400 border-green-500/20",
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
  IT: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  MAINTENANCE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
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
