"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { FootageRequestStatusBadge, FootageRequestPartyBadge } from "./footage-request-status-badge"
import { CreateFootageRequestDialog } from "./create-footage-request-dialog"
import { formatDate } from "@/lib/utils"
import { hasPermission } from "@/lib/permissions"
import type { FootageRequestWithDetails, Role } from "@/types"

export function FootageRequestList() {
  const { data: session } = useSession()
  const router = useRouter()
  const [requests, setRequests] = useState<FootageRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  const actorRole = (session?.user as { role?: Role })?.role
  const canCreate = actorRole ? hasPermission(actorRole, "footage:create") : false

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    const res = await fetch(`/api/footage-requests?${params}`)
    const data = await res.json()
    setRequests(data.requests ?? [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return (
    <div className="space-y-4">
      {/* Filters + action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
            <SelectItem value="DENIED">Denied</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <p className="text-sm text-muted-foreground">{requests.length} request(s)</p>

        {canCreate && (
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New request
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Camera / area</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Footage window</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No footage requests found
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/footage-requests/${r.id}`)}
                >
                  <TableCell>
                    <FootageRequestStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {r.location.locationNumber} — {r.location.name}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="line-clamp-1 text-sm">{r.cameraArea}</span>
                  </TableCell>
                  <TableCell>
                    <FootageRequestPartyBadge party={r.requestingParty} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(r.startDateTime)} – {formatDate(r.endDateTime)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateFootageRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchRequests}
      />
    </div>
  )
}
