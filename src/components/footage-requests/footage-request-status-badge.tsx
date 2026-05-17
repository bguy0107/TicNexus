import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FootageRequestStatus, RequestingParty } from "@/types"

const STATUS_LABELS: Record<FootageRequestStatus, string> = {
  PENDING: "Pending",
  FULFILLED: "Fulfilled",
  DENIED: "Denied",
}

const STATUS_CLASSES: Record<FootageRequestStatus, string> = {
  PENDING:
    "bg-amber-300 text-amber-900 border-amber-500 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700",
  FULFILLED:
    "bg-green-300 text-green-900 border-green-500 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
  DENIED:
    "bg-red-300 text-red-900 border-red-500 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
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
  LAW_ENFORCEMENT:
    "bg-blue-300 text-blue-900 border-blue-500 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
  INTERNAL:
    "bg-purple-300 text-purple-900 border-purple-500 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700",
}

export function FootageRequestPartyBadge({ party }: { party: RequestingParty }) {
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", PARTY_CLASSES[party])}>
      {PARTY_LABELS[party]}
    </Badge>
  )
}
