"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { FootageRequestStatusBadge, FootageRequestPartyBadge } from "./footage-request-status-badge"
import { ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { hasPermission } from "@/lib/permissions"
import type { FootageRequestWithDetails, Role } from "@/types"

interface FootageRequestDetailProps {
  requestId: string
}

export function FootageRequestDetail({ requestId }: FootageRequestDetailProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [footageRequest, setFootageRequest] = useState<FootageRequestWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolveAction, setResolveAction] = useState<"FULFILLED" | "DENIED" | null>(null)
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolving, setResolving] = useState(false)

  const actorRole = (session?.user as { role?: Role; departments?: string[] })?.role
  const actorDepts = (session?.user as { departments?: string[] })?.departments ?? []
  const canResolve = actorRole
    ? hasPermission(actorRole, "footage:resolve") &&
      (actorRole !== "TECHNICIAN" || actorDepts.includes("IT"))
    : false
  const isPending = footageRequest?.status === "PENDING"

  const fetchRequest = useCallback(async () => {
    const res = await fetch(`/api/footage-requests/${requestId}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setFootageRequest(data.request)
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  const openResolveDialog = (action: "FULFILLED" | "DENIED") => {
    setResolveAction(action)
    setResolutionNote("")
    setResolveDialogOpen(true)
  }

  const handleResolveConfirm = async () => {
    if (!resolveAction) return
    setResolving(true)
    setResolveDialogOpen(false)

    const res = await fetch(`/api/footage-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: resolveAction,
        resolutionNote: resolutionNote.trim() || undefined,
      }),
    })

    setResolving(false)

    if (res.ok) {
      toast({
        title: resolveAction === "FULFILLED" ? "Request fulfilled" : "Request denied",
      })
      fetchRequest()
    } else {
      let message = "Something went wrong"
      try {
        const data = await res.json()
        message = data.error ?? message
      } catch {}
      toast({ title: "Error", description: message, variant: "destructive" })
    }

    setResolveAction(null)
    setResolutionNote("")
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>
  }

  if (!footageRequest) {
    return <div className="text-muted-foreground text-sm">Request not found.</div>
  }

  return (
    <>
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "FULFILLED" ? "Fulfill request" : "Deny request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="resolution-note">Note (optional)</Label>
              <textarea
                id="resolution-note"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={
                  resolveAction === "FULFILLED"
                    ? "How was the footage provided?"
                    : "Reason for denial..."
                }
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveConfirm}
              disabled={resolving}
              className={
                resolveAction === "DENIED"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {resolving
                ? "Saving..."
                : resolveAction === "FULFILLED"
                  ? "Mark as fulfilled"
                  : "Deny request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" size="sm" className="gap-1 -ml-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FootageRequestStatusBadge status={footageRequest.status} />
            <FootageRequestPartyBadge party={footageRequest.requestingParty} />
          </div>
          <h1 className="text-xl font-bold leading-snug">
            Footage Request — {footageRequest.location.locationNumber}{" "}
            {footageRequest.location.name}
          </h1>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Location</p>
            <p>
              {footageRequest.location.locationNumber} — {footageRequest.location.name}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Submitted by</p>
            <p>
              {footageRequest.createdBy.firstName} {footageRequest.createdBy.lastName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Footage start</p>
            <p>{new Date(footageRequest.startDateTime).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Footage end</p>
            <p>{new Date(footageRequest.endDateTime).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Camera / area</p>
            <p>{footageRequest.cameraArea}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Submitted</p>
            <p>{formatDate(footageRequest.createdAt)}</p>
          </div>
          {footageRequest.requestingParty === "LAW_ENFORCEMENT" && footageRequest.officerName && (
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs mb-1">Officer / contact</p>
              <p>{footageRequest.officerName}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Resolve actions */}
        {canResolve && isPending && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-400">This request is pending</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fulfill or deny after retrieving the footage.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => openResolveDialog("FULFILLED")}
                disabled={resolving}
              >
                Fulfill
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => openResolveDialog("DENIED")}
                disabled={resolving}
              >
                Deny
              </Button>
            </div>
          </div>
        )}

        {/* Resolution details */}
        {!isPending && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Resolution
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Resolved by</p>
                <p>
                  {footageRequest.resolvedBy
                    ? `${footageRequest.resolvedBy.firstName} ${footageRequest.resolvedBy.lastName}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Resolved at</p>
                <p>
                  {footageRequest.resolvedAt
                    ? new Date(footageRequest.resolvedAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              {footageRequest.resolutionNote && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-1">Note</p>
                  <p>{footageRequest.resolutionNote}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
