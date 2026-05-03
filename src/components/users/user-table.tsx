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
import { InviteUserDialog } from "./invite-user-dialog"
import { EditUserDialog } from "./edit-user-dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserWithRelations, Role } from "@/types"

export function UserTable() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: string; name: string } | null>(
    null
  )
  const [deactivating, setDeactivating] = useState(false)
  const { toast } = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/users")
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleDeactivateConfirmed = async () => {
    if (!confirmDeactivate) return
    setDeactivating(true)
    const res = await fetch(`/api/users/${confirmDeactivate.id}`, { method: "DELETE" })
    setDeactivating(false)
    setConfirmDeactivate(null)
    if (res.ok) {
      toast({
        title: "User deactivated",
        description: `${confirmDeactivate.name} has been deactivated.`,
      })
      fetchUsers()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const handleReactivate = async (userId: string, userName: string) => {
    const res = await fetch(`/api/users/${userId}/reactivate`, { method: "POST" })
    if (res.ok) {
      toast({ title: "User reactivated", description: `${userName} has been reactivated.` })
      fetchUsers()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const actorRole = (session?.user as { role?: Role })?.role ?? "STORE_USER"
  const isAdmin = actorRole === "ADMIN"

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading users…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{users.length} user(s)</p>
        <InviteUserDialog actorRole={actorRole} onSuccess={fetchUsers} />
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Franchise / Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isSelf = user.id === session?.user?.id
                const showMenu = !isSelf && (isAdmin || !user.deletedAt)

                return (
                  <TableRow key={user.id} className={user.deletedAt ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <UserRoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.userFranchises.length > 0
                        ? user.userFranchises.map((uf) => uf.franchise.name).join(", ")
                        : user.userLocations.length > 0
                          ? user.userLocations
                              .map((ul) => `${ul.location.name} (${ul.location.franchise.name})`)
                              .join(", ")
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {user.deletedAt ? (
                        <Badge variant="destructive">Inactive</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      {showMenu && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isAdmin && (
                              <>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => setEditingUser(user)}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {!user.deletedAt ? (
                              <DropdownMenuItem
                                className="text-destructive cursor-pointer"
                                onClick={() =>
                                  setConfirmDeactivate({
                                    id: user.id,
                                    name: `${user.firstName} ${user.lastName}`,
                                  })
                                }
                              >
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              isAdmin && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() =>
                                    handleReactivate(user.id, `${user.firstName} ${user.lastName}`)
                                  }
                                >
                                  Reactivate
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        />
      )}

      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              Deactivate{" "}
              <span className="font-medium text-foreground">{confirmDeactivate?.name}</span>? They
              will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivate(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirmed}
              disabled={deactivating}
            >
              {deactivating ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
