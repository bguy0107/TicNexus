import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FootageRequestStatus, RequestingParty } from "@/types"

const STATUS_LABELS: Record<FootageRequestStatus, string> = {
  PENDING: "Pending",
  FULFILLED: "Fulfilled",
  DENIED: "Denied",
}

const STATUS_CLASSES: Record<FootageRequestStatus, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FULFILLED: "bg-green-500/10 text-green-400 border-green-500/20",
  DENIED: "bg-red-500/10 text-red-400 border-red-500/20",
}

export function FootageRequestStatusBadge({ status }: { status: FootageRequestStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium whitespace-nowrap", STATUS_CLASSES[status])}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const PARTY_LABELS: Record<RequestingParty, string> = {
  LAW_ENFORCEMENT: "Law Enforcement",
  INTERNAL: "Internal",
}

const PARTY_CLASSES: Record<RequestingParty, string> = {
  LAW_ENFORCEMENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  INTERNAL: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

export function FootageRequestPartyBadge({ party }: { party: RequestingParty }) {
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", PARTY_CLASSES[party])}>
      {PARTY_LABELS[party]}
    </Badge>
  )
}
