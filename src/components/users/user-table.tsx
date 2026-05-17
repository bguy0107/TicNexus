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
import { Badge } from "@/components/ui/badge"
import { UserRoleBadge } from "./user-role-badge"
import { InviteUserDialog } from "./invite-user-dialog"
import { EditUserDialog } from "./edit-user-dialog"
import { cn } from "@/lib/utils"
import { isHigherRole, hasPermission } from "@/lib/permissions"
import type { UserWithRelations, Role } from "@/types"

export function UserTable() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null)
  const [editReadOnly, setEditReadOnly] = useState(false)

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

  const actorRole = (session?.user as { role?: Role })?.role ?? "STORE_USER"

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
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isSelf = user.id === session?.user?.id
                const canEdit =
                  !isSelf &&
                  isHigherRole(actorRole, user.role) &&
                  (hasPermission(actorRole, "user:update:any") ||
                    hasPermission(actorRole, "user:update:below"))

                return (
                  <TableRow
                    key={user.id}
                    className={cn(user.deletedAt && "opacity-50", "cursor-pointer")}
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
                    <TableCell>
                      {user.deletedAt ? (
                        <Badge variant="destructive" className="w-fit">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit">
                          Active
                        </Badge>
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
    </div>
  )
}
