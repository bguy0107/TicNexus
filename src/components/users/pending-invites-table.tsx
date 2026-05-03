"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { UserRoleBadge } from "./user-role-badge"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { MoreHorizontal, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Invitation {
  id: string
  token: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
  invitedBy: { firstName: string; lastName: string }
  franchise: { name: string } | null
  location: { name: string } | null
}

export function PendingInvitesTable() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Invitation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const fetchInvitations = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/invitations")
    const data = await res.json()
    setInvitations(data.invitations ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const handleResend = async (invitation: Invitation) => {
    setResending(invitation.id)
    const res = await fetch(`/api/invitations/${invitation.token}/resend`, { method: "POST" })
    setResending(null)
    if (res.ok) {
      toast({
        title: "Invitation resent",
        description: `A new invite link was sent to ${invitation.email}.`,
      })
      fetchInvitations()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await fetch(`/api/invitations/${confirmDelete.token}`, { method: "DELETE" })
    setDeleting(false)
    setConfirmDelete(null)
    if (res.ok) {
      toast({
        title: "Invitation cancelled",
        description: `Invite for ${confirmDelete.email} has been removed.`,
      })
      fetchInvitations()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading invitations…</div>
  }

  const now = new Date()

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {invitations.length} pending invitation(s)
          </p>
          <Button variant="outline" size="sm" onClick={fetchInvitations} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No pending invitations
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => {
                  const isExpired = new Date(inv.expiresAt) < now
                  return (
                    <TableRow key={inv.id} className={isExpired ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <UserRoleBadge role={inv.role as import("@/types").Role} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.franchise?.name ?? inv.location?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive" className="w-fit">
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="w-fit">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={resending === inv.id}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleResend(inv)}
                            >
                              Resend invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={() => setConfirmDelete(inv)}
                            >
                              Cancel invite
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel invitation</DialogTitle>
            <DialogDescription>
              Cancel the pending invite for{" "}
              <span className="font-medium text-foreground">{confirmDelete?.email}</span>? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Keep invite
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={deleting}>
              {deleting ? "Cancelling…" : "Cancel invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
