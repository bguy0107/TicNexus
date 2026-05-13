"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { TicketStatusBadge, TicketDepartmentBadge } from "./ticket-status-badge"
import { UserRoleBadge } from "@/components/users/user-role-badge"
import { formatDate, cn } from "@/lib/utils"
import { hasPermission } from "@/lib/permissions"
import { ArrowLeft, Paperclip, ImagePlus, X, AlertTriangle } from "lucide-react"
import type { TicketWithDetails, TicketHistoryEntry, Role, TicketStatus } from "@/types"
import type { Role as PrismaRole } from "@prisma/client"

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ORDERED", label: "Ordered" },
  { value: "MONITORING", label: "Monitoring" },
  { value: "AWAITING_APPROVAL", label: "Awaiting Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "PROJECTED", label: "Projected" },
  { value: "CLOSED", label: "Closed" },
]

interface TicketDetailProps {
  ticketId: string
}

export function TicketDetail({ ticketId }: TicketDetailProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [newStatus, setNewStatus] = useState<TicketStatus | "">("")
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalCost, setApprovalCost] = useState("")
  const [approvalComment, setApprovalComment] = useState("")
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approveComment, setApproveComment] = useState("")
  const [approving, setApproving] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectDeadline, setProjectDeadline] = useState("")
  const [projectComment, setProjectComment] = useState("")
  const [projecting, setProjecting] = useState(false)
  const [changeDeadlineOpen, setChangeDeadlineOpen] = useState(false)
  const [newDeadline, setNewDeadline] = useState("")
  const [savingDeadline, setSavingDeadline] = useState(false)
  const [statusCommentDialogOpen, setStatusCommentDialogOpen] = useState(false)
  const [statusCommentPending, setStatusCommentPending] = useState<TicketStatus | null>(null)
  const [statusComment, setStatusComment] = useState("")

  const actorRole = (session?.user as { role?: Role })?.role
  const actorId = session?.user?.id

  const canUpdateStatus = actorRole ? hasPermission(actorRole, "ticket:update_status") : false
  const isCreator = actorId && ticket?.createdById === actorId

  // For PROJECTED tickets: stricter access rules; creator-close does not apply.
  const canEditProjected = (() => {
    if (!actorRole || ticket?.status !== "PROJECTED") return null // not relevant
    if (actorRole === "ADMIN" || actorRole === "FRANCHISE_MANAGER" || actorRole === "SUPERVISOR")
      return true
    if (actorRole === "TECHNICIAN" && ticket.deadline) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const deadlineDay = new Date(ticket.deadline)
      deadlineDay.setHours(0, 0, 0, 0)
      return today >= deadlineDay
    }
    return false
  })()

  const isProjected = ticket?.status === "PROJECTED"
  const canClose = isProjected ? canEditProjected === true : canUpdateStatus || isCreator
  const canChangeStatus = isProjected ? canEditProjected === true : canUpdateStatus
  const canApprove =
    canUpdateStatus &&
    (actorRole === "SUPERVISOR" || actorRole === "FRANCHISE_MANAGER" || actorRole === "ADMIN")
  const canChangeDeadline =
    isProjected &&
    (actorRole === "ADMIN" || actorRole === "FRANCHISE_MANAGER" || actorRole === "SUPERVISOR")

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/tickets/${ticketId}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setTicket(data.ticket)
    setNewStatus(data.ticket.status)
    setLoading(false)
  }, [ticketId])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  const submitStatusChange = async (body: object) => {
    setUpdatingStatus(true)
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setUpdatingStatus(false)
    if (res.ok) {
      toast({ title: "Status updated" })
      setNewStatus("")
      fetchTicket()
    } else {
      let message = "Something went wrong"
      try {
        const data = await res.json()
        message = data.error ?? message
      } catch {}
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const handleStatusChange = () => {
    if (!newStatus || !ticket) return
    if (newStatus === "AWAITING_APPROVAL") {
      setApprovalCost("")
      setApprovalComment("")
      setApprovalDialogOpen(true)
    } else if (newStatus === "ORDERED" || newStatus === "MONITORING") {
      setStatusComment("")
      setStatusCommentPending(newStatus)
      setStatusCommentDialogOpen(true)
    } else {
      submitStatusChange({ status: newStatus })
    }
  }

  const handleStatusCommentConfirm = async () => {
    if (!statusCommentPending || !statusComment.trim()) return
    setStatusCommentDialogOpen(false)
    await submitStatusChange({ status: statusCommentPending, comment: statusComment.trim() })
    setStatusCommentPending(null)
    setStatusComment("")
  }

  const handleApprovalConfirm = async () => {
    const cost = parseFloat(approvalCost)
    if (!approvalCost || isNaN(cost) || cost <= 0) return
    setApprovalDialogOpen(false)
    await submitStatusChange({
      status: "AWAITING_APPROVAL",
      cost,
      comment: approvalComment.trim() || undefined,
    })
  }

  const handleApproveConfirm = async () => {
    setApproving(true)
    setApproveDialogOpen(false)
    await submitStatusChange({
      status: "APPROVED",
      comment: approveComment.trim() || undefined,
    })
    setApproving(false)
    setApproveComment("")
  }

  const handleProjectConfirm = async () => {
    if (!projectDeadline) return
    setProjecting(true)
    setProjectDialogOpen(false)
    await submitStatusChange({
      status: "PROJECTED",
      deadline: projectDeadline,
      comment: projectComment.trim() || undefined,
    })
    setProjecting(false)
    setProjectDeadline("")
    setProjectComment("")
  }

  const handleDeadlineChange = async () => {
    if (!newDeadline) return
    setSavingDeadline(true)
    setChangeDeadlineOpen(false)
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: newDeadline }),
    })
    setSavingDeadline(false)
    if (res.ok) {
      toast({ title: "Deadline updated" })
      fetchTicket()
    } else {
      let message = "Something went wrong"
      try {
        const data = await res.json()
        message = data.error ?? message
      } catch {}
      toast({ title: "Error", description: message, variant: "destructive" })
    }
    setNewDeadline("")
  }

  const handleAddComment = async () => {
    if (!comment.trim() && !selectedFile) return
    if (selectedFile) {
      const isVideo = selectedFile.type.startsWith("video/")
      const limitBytes = isVideo ? 75 * 1024 * 1024 : 50 * 1024 * 1024
      const limitLabel = isVideo ? "75 MB" : "50 MB"
      if (selectedFile.size > limitBytes) {
        toast({
          title: "File too large",
          description: `Maximum upload size is ${limitLabel}.`,
          variant: "destructive",
        })
        return
      }
    }
    setSubmittingComment(true)

    const fd = new FormData()
    if (comment.trim()) fd.append("comment", comment.trim())
    if (selectedFile) fd.append("file", selectedFile)

    const res = await fetch(`/api/tickets/${ticketId}/history`, { method: "POST", body: fd })
    setSubmittingComment(false)

    if (res.ok) {
      setComment("")
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ""
      fetchTicket()
    } else {
      let message = "Something went wrong"
      try {
        const data = await res.json()
        message = data.error ?? message
      } catch {}
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading ticket...</div>
  }

  if (!ticket) {
    return <div className="text-muted-foreground text-sm">Ticket not found.</div>
  }

  const isMedia = (name: string) =>
    /\.(jpe?g|png|gif|webp)$/i.test(name) || /\.(mp4|mov)$/i.test(name)

  const fileUrl = (attachment: string) =>
    `/api/tickets/files?path=${encodeURIComponent(attachment)}`

  return (
    <>
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Awaiting Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="approval-cost">
                Cost ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="approval-cost"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={approvalCost}
                onChange={(e) => setApprovalCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-comment">Comment</Label>
              <textarea
                id="approval-comment"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Optional comment..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalConfirm}
              disabled={updatingStatus || !approvalCost || parseFloat(approvalCost) <= 0}
            >
              {updatingStatus ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="approve-comment">Comment (optional)</Label>
              <textarea
                id="approve-comment"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Optional approval comment..."
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveConfirm} disabled={approving}>
              {approving ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-deadline">
                Deadline <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-deadline"
                type="date"
                value={projectDeadline}
                onChange={(e) => setProjectDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-comment">Comment (optional)</Label>
              <textarea
                id="project-comment"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Optional comment..."
                value={projectComment}
                onChange={(e) => setProjectComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProjectConfirm} disabled={projecting || !projectDeadline}>
              {projecting ? "Saving..." : "Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeDeadlineOpen} onOpenChange={setChangeDeadlineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change deadline</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="new-deadline">
              New deadline <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-deadline"
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDeadlineOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeadlineChange} disabled={savingDeadline || !newDeadline}>
              {savingDeadline ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusCommentDialogOpen} onOpenChange={setStatusCommentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Set status to {statusCommentPending === "ORDERED" ? "Ordered" : "Monitoring"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-comment">
                Comment <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="status-comment"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={
                  statusCommentPending === "ORDERED"
                    ? "What was ordered and from where?"
                    : "What is being monitored?"
                }
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusCommentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusCommentConfirm}
              disabled={updatingStatus || !statusComment.trim()}
            >
              {updatingStatus ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 max-w-2xl">
        {/* Back */}
        <Button variant="ghost" size="sm" className="gap-1 -ml-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TicketDepartmentBadge department={ticket.type} />
            <TicketStatusBadge status={ticket.status} />
          </div>
          <h1 className="text-xl font-bold leading-snug">{ticket.issue}</h1>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Location</p>
            <p>
              {ticket.location.locationNumber} — {ticket.location.name}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Opened by</p>
            <p>
              {ticket.createdBy.firstName} {ticket.createdBy.lastName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Created</p>
            <p>{formatDate(ticket.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Deadline</p>
            <p>{ticket.deadline ? formatDate(ticket.deadline) : "—"}</p>
          </div>
        </div>

        <Separator />

        {/* Change Deadline button — shown for PROJECTED tickets */}
        {canChangeDeadline && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-sky-400">This ticket is projected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deadline:{" "}
                {ticket.deadline ? (
                  formatDate(ticket.deadline)
                ) : (
                  <span className="italic">not set</span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-sky-500/50 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 shrink-0"
              onClick={() => {
                setNewDeadline(
                  ticket.deadline ? new Date(ticket.deadline).toISOString().split("T")[0] : ""
                )
                setChangeDeadlineOpen(true)
              }}
              disabled={savingDeadline}
            >
              {savingDeadline ? "Saving..." : "Change Deadline"}
            </Button>
          </div>
        )}

        {/* Approve / Project buttons — shown for AWAITING_APPROVAL tickets */}
        {canApprove && ticket.status === "AWAITING_APPROVAL" && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">This ticket is awaiting approval</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review the cost in the history below before taking action.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setApproveComment("")
                  setApproveDialogOpen(true)
                }}
                disabled={approving || projecting || updatingStatus}
              >
                {approving ? "Approving..." : "Approve"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setProjectDeadline("")
                  setProjectComment("")
                  setProjectDialogOpen(true)
                }}
                disabled={approving || projecting || updatingStatus}
              >
                {projecting ? "Saving..." : "Project"}
              </Button>
            </div>
          </div>
        )}

        {/* Status change */}
        {(canChangeStatus || (canClose && ticket.status !== "CLOSED")) && (
          <div className="space-y-2">
            <Label>Change status</Label>
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TicketStatus)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((o) => {
                    if (o.value === "CLOSED") return canClose
                    return canChangeStatus
                  }).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusChange}
                disabled={!newStatus || newStatus === ticket.status || updatingStatus}
                size="sm"
              >
                {updatingStatus ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* History */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            History
          </h2>

          {(ticket.history ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}

          {(ticket.history ?? []).map((entry: TicketHistoryEntry) => {
            const isAwaitingApproval = entry.statusTo === "AWAITING_APPROVAL"
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex gap-3",
                  isAwaitingApproval && "bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
                )}
              >
                {isAwaitingApproval ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-border mt-2 flex-shrink-0" />
                )}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {entry.user.firstName} {entry.user.lastName}
                    </span>
                    <UserRoleBadge role={entry.user.role as PrismaRole} />
                    <span>·</span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>

                  {(entry.statusFrom !== null || entry.statusTo !== null) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      {entry.statusFrom === null ? (
                        <>
                          <span className="text-muted-foreground">Opened as</span>
                          <TicketStatusBadge status={entry.statusTo as TicketStatus} />
                        </>
                      ) : (
                        <>
                          <TicketStatusBadge status={entry.statusFrom as TicketStatus} />
                          <span className="text-muted-foreground">→</span>
                          <TicketStatusBadge status={entry.statusTo as TicketStatus} />
                        </>
                      )}
                    </div>
                  )}

                  {entry.cost && (
                    <p className="text-sm font-semibold text-amber-400">
                      Cost: ${parseFloat(entry.cost).toFixed(2)}
                    </p>
                  )}
                  {entry.comment && (
                    <p className="text-sm text-muted-foreground">{entry.comment}</p>
                  )}

                  {entry.attachment && (
                    <div className="mt-1">
                      {isMedia(entry.attachment) ? (
                        entry.attachment.match(/\.(mp4|mov)$/i) ? (
                          <video
                            src={fileUrl(entry.attachment)}
                            controls
                            className="max-w-xs rounded border"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={fileUrl(entry.attachment)}
                            alt="attachment"
                            className="max-w-xs rounded border"
                          />
                        )
                      ) : (
                        <a
                          href={fileUrl(entry.attachment)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          {entry.attachment.split("/").pop()}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Add comment */}
        <div className="space-y-2">
          <Label>Add comment</Label>

          {/* Hidden file input triggered by the icon button */}
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileRef}
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />

          <div className="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <textarea
              className="w-full min-h-[80px] bg-transparent px-3 pt-3 pb-2 text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
              placeholder="Write a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {/* File preview */}
            {selectedFile && (
              <div className="px-3 pb-2">
                <div className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {selectedFile.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="preview"
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span className="max-w-[160px] truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileRef.current) fileRef.current.value = ""
                    }}
                    className="ml-1 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between border-t border-input px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => fileRef.current?.click()}
                title="Attach image or video"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={submittingComment || (!comment.trim() && !selectedFile)}
              >
                {submittingComment ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
