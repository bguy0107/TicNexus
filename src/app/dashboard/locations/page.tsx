import { requireRole } from "@/lib/session"
import { LocationTable } from "@/components/locations/location-table"

export default async function LocationsPage() {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN"])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
        <p className="text-muted-foreground">Manage franchise locations</p>
      </div>
      <LocationTable />
    </div>
  )
}
