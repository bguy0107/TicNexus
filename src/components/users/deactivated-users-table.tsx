"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { UserRoleBadge } from "./user-role-badge"
import { EditUserDialog } from "./edit-user-dialog"
import { formatDate } from "@/lib/utils"
import { isHigherRole, hasPermission } from "@/lib/permissions"
import { useToast } from "@/components/ui/use-toast"
import { Trash2 } from "lucide-react"
import type { UserWithRelations, Role } from "@/types"

export function DeactivatedUsersTable() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null)
  const [editReadOnly, setEditReadOnly] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/users?deactivated=true")
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const actorRole = (session?.user as { role?: Role })?.role ?? "STORE_USER"

  const canDelete = (targetRole: Role) =>
    (hasPermission(actorRole, "user:delete:any") ||
      hasPermission(actorRole, "user:delete:below")) &&
    isHigherRole(actorRole, targetRole)

  const handleDelete = async () => {
    if (!deletingUser) return
    setDeleting(true)
    const res = await fetch(`/api/users/${deletingUser.id}/permanent`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      toast({
        title: "User deleted",
        description: `${deletingUser.firstName} ${deletingUser.lastName} has been permanently deleted.`,
      })
      setDeletingUser(null)
      fetchUsers()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading deactivated users…</div>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{users.length} deactivated user(s)</p>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Deactivated</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No deactivated users
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const canEdit =
                  isHigherRole(actorRole, user.role) &&
                  (hasPermission(actorRole, "user:reactivate:any") ||
                    hasPermission(actorRole, "user:reactivate:below"))

                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer opacity-60 hover:opacity-100"
                    onClick={() => {
                      setEditingUser(user)
                      setEditReadOnly(!canEdit)
                    }}
                  >
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <UserRoleBadge role={user.role} />
                        {user.role === "TECHNICIAN" &&
                          user.departments &&
                          user.departments.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {user.departments
                                .map((d) => (d === "IT" ? "IT" : "Maintenance"))
                                .join(", ")}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.deletedAt ? formatDate(user.deletedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {canDelete(user.role) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingUser(user)
                          }}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Permanently delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null)
          }}
          onSuccess={fetchUsers}
          readOnly={editReadOnly}
        />
      )}

      <Dialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Permanently delete user</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete{" "}
            <span className="font-medium text-foreground">
              {deletingUser?.firstName} {deletingUser?.lastName}
            </span>
            ? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
