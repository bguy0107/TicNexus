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
import { Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { TicketStatusBadge } from "./ticket-status-badge"
import { CreateTicketDialog } from "./create-ticket-dialog"
import { formatDate } from "@/lib/utils"
import { hasPermission } from "@/lib/permissions"
import type { TicketWithDetails, Role, TicketStatus } from "@/types"

const TYPE_LABELS = { IT: "IT", MAINTENANCE: "Maintenance" }

type SortField = "status" | "location" | "createdAt" | "deadline" | "type"
type SortOrder = "asc" | "desc"

function SortableHead({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string
  field: SortField
  sortBy: SortField
  sortOrder: SortOrder
  onSort: (field: SortField) => void
}) {
  const active = sortBy === field
  return (
    <TableHead>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {active ? (
          sortOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

export function TicketList() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [sortBy, setSortBy] = useState<SortField>("createdAt")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const actorRole = (session?.user as { role?: Role })?.role

  const canCreate = actorRole ? hasPermission(actorRole, "ticket:create") : false

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter !== "ALL") params.set("type", typeFilter)
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    const res = await fetch(`/api/tickets?${params}`)
    const data = await res.json()
    setTickets(data.tickets ?? [])
    setLoading(false)
  }, [typeFilter, statusFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  return (
    <div className="space-y-4">
      {/* Filters + action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="IT">IT</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="AWAITING_APPROVAL">Awaiting Approval</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <p className="text-sm text-muted-foreground">{tickets.length} ticket(s)</p>

        {canCreate && (
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Status"
                field="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHead
                label="Location"
                field="location"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <TableHead>Issue</TableHead>
              <SortableHead
                label="Created"
                field="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHead
                label="Deadline"
                field="deadline"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHead
                label="Type"
                field="type"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                >
                  <TableCell>
                    <TicketStatusBadge status={t.status as TicketStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {t.location.locationNumber} — {t.location.name}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="line-clamp-2 text-sm">{t.issue}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(t.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {t.deadline ? formatDate(t.deadline) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
                      {TYPE_LABELS[t.type]}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchTickets} />
    </div>
  )
}
