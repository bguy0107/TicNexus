import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getFootageLocationIds } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

const FOOTAGE_INCLUDE = {
  location: { select: { id: true, name: true, locationNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const

async function resolveRequest(id: string, userId: string, role: Role) {
  const req = await db.footageRequest.findUnique({
    where: { id },
    include: FOOTAGE_INCLUDE,
  })
  if (!req) return null

  if (role !== "ADMIN") {
    const locationIds = await getFootageLocationIds(userId, role)
    if (locationIds && !locationIds.includes(req.locationId)) return null
  }

  return req
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "footage:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const req = await resolveRequest(id, session.user.id, role)
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ request: req })
}

const patchSchema = z.object({
  status: z.enum(["FULFILLED", "DENIED"]),
  resolutionNote: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "footage:resolve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // TECHNICIANs must be in the IT department to resolve footage requests
  if (role === "TECHNICIAN" && !session.user.departments.includes("IT")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const existing = await db.footageRequest.findUnique({
    where: { id },
    select: { id: true, locationId: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Request has already been resolved" }, { status: 400 })
  }

  // Scope check
  if (role !== "ADMIN") {
    const locationIds = await getFootageLocationIds(session.user.id, role)
    if (locationIds && !locationIds.includes(existing.locationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.footageRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolutionNote: parsed.data.resolutionNote?.trim() || null,
      resolvedById: session.user.id,
      resolvedAt: new Date(),
    },
    include: FOOTAGE_INCLUDE,
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "footage_request",
    entityId: id,
    changes: { statusFrom: existing.status, statusTo: parsed.data.status },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ request: updated })
}
