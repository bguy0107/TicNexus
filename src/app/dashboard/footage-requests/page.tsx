import { requireRole } from "@/lib/session"
import { FootageRequestList } from "@/components/footage-requests/footage-request-list"

export default async function FootageRequestsPage() {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Footage Requests</h1>
        <p className="text-muted-foreground">Request and track video footage from locations</p>
      </div>
      <FootageRequestList />
    </div>
  )
}
