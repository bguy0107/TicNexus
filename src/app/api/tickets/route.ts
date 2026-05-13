import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getTicketLocationIds } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import path from "path"
import fs from "fs/promises"
import type { Role, Prisma } from "@prisma/client"

const TICKET_INCLUDE = {
  location: { select: { id: true, name: true, locationNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "ticket:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const locationIds = await getTicketLocationIds(session.user.id, role)

  const { searchParams } = request.nextUrl
  const typeFilter = searchParams.get("type") as "IT" | "MAINTENANCE" | null
  const statusFilter = searchParams.get("status") as
    | "OPEN"
    | "IN_PROGRESS"
    | "AWAITING_APPROVAL"
    | "CLOSED"
    | null

  const SORT_FIELDS = ["status", "location", "createdAt", "deadline", "type"] as const
  type SortField = (typeof SORT_FIELDS)[number]
  const sortByParam = searchParams.get("sortBy")
  const sortBy: SortField = SORT_FIELDS.includes(sortByParam as SortField)
    ? (sortByParam as SortField)
    : "createdAt"
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc"

  const order = sortOrder as Prisma.SortOrder
  const orderBy: Prisma.TicketOrderByWithRelationInput =
    sortBy === "location" ? { location: { name: order } } : { [sortBy]: order }

  const tickets = await db.ticket.findMany({
    where: {
      ...(locationIds !== null ? { locationId: { in: locationIds } } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: TICKET_INCLUDE,
    orderBy,
  })

  return NextResponse.json({ tickets })
}

const createSchema = z.object({
  type: z.enum(["IT", "MAINTENANCE"]),
  issue: z.string().min(1),
  locationId: z.string().min(1),
  deadline: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "ticket:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const body = {
    type: formData.get("type"),
    issue: formData.get("issue"),
    locationId: formData.get("locationId"),
    deadline: formData.get("deadline") || undefined,
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Verify user has access to the chosen location
  const locationIds = await getTicketLocationIds(session.user.id, role)
  if (locationIds !== null && !locationIds.includes(parsed.data.locationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Verify location exists
  const location = await db.location.findUnique({
    where: { id: parsed.data.locationId, deletedAt: null },
    select: { id: true },
  })
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 })

  const ticket = await db.ticket.create({
    data: {
      type: parsed.data.type,
      issue: parsed.data.issue,
      locationId: parsed.data.locationId,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      createdById: session.user.id,
    },
    include: TICKET_INCLUDE,
  })

  // Handle optional file upload
  const file = formData.get("file") as File | null
  if (file && file.size > 0) {
    const isVideo = file.type.startsWith("video/")
    const limitBytes = isVideo ? 75 * 1024 * 1024 : 50 * 1024 * 1024
    const limitLabel = isVideo ? "75 MB" : "50 MB"
    if (file.size > limitBytes) {
      await db.ticket.delete({ where: { id: ticket.id } })
      return NextResponse.json({ error: `File must be ${limitLabel} or smaller` }, { status: 400 })
    }
  }
  let attachmentPath: string | null = null
  if (file && file.size > 0) {
    const dir = path.resolve(process.cwd(), "uploads", "tickets", ticket.id)
    await fs.mkdir(dir, { recursive: true })
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const dest = path.join(dir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(dest, buffer)
    attachmentPath = `${ticket.id}/${safeName}`
  }

  // Write initial history entry (ticket opened)
  await db.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: session.user.id,
      statusFrom: null,
      statusTo: "OPEN",
      attachment: attachmentPath,
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "ticket",
    entityId: ticket.id,
    changes: { type: ticket.type, locationId: ticket.locationId, status: ticket.status },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(ticket, { status: 201 })
}
