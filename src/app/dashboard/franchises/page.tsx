import { requireRole } from "@/lib/session"
import { FranchiseTable } from "@/components/franchises/franchise-table"

export default async function FranchisesPage() {
  await requireRole(["ADMIN", "TECHNICIAN"])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Franchises</h1>
        <p className="text-muted-foreground">Manage franchise organizations</p>
      </div>
      <FranchiseTable />
    </div>
  )
}
