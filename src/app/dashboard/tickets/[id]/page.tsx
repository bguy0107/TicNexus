import { requireRole } from "@/lib/session"
import { TicketDetail } from "@/components/tickets/ticket-detail"

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"])
  const { id } = await params
  return (
    <div className="space-y-6">
      <TicketDetail ticketId={id} />
    </div>
  )
}
