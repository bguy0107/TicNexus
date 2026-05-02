import { requireRole } from "@/lib/session"
import { UserTable } from "@/components/users/user-table"

export default async function UsersPage() {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR"])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and invitations</p>
      </div>
      <UserTable />
    </div>
  )
}
