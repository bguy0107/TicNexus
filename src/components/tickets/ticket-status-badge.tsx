import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TicketStatus } from "@/types"

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  PROJECTED: "Projected",
  CLOSED: "Closed",
}

const STATUS_CLASSES: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IN_PROGRESS: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  AWAITING_APPROVAL: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PROJECTED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
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
