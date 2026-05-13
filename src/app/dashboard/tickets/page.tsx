import { requireRole } from "@/lib/session"
import { TicketList } from "@/components/tickets/ticket-list"

export default async function TicketsPage() {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        <p className="text-muted-foreground">Track IT and Maintenance issues</p>
      </div>
      <TicketList />
    </div>
  )
}
