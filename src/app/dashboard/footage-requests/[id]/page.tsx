import { requireRole } from "@/lib/session"
import { FootageRequestDetail } from "@/components/footage-requests/footage-request-detail"

export default async function FootageRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"])
  const { id } = await params
  return (
    <div className="space-y-6">
      <FootageRequestDetail requestId={id} />
    </div>
  )
}
