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

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "footage:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const locationIds = await getFootageLocationIds(session.user.id, role)

  const { searchParams } = request.nextUrl
  const statusFilter = searchParams.get("status") as "PENDING" | "FULFILLED" | "DENIED" | null

  const requests = await db.footageRequest.findMany({
    where: {
      ...(locationIds !== null ? { locationId: { in: locationIds } } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: FOOTAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ requests })
}

const createSchema = z
  .object({
    locationId: z.string().min(1),
    startDateTime: z.string().min(1),
    endDateTime: z.string().min(1),
    cameraArea: z.string().min(1),
    requestingParty: z.enum(["LAW_ENFORCEMENT", "INTERNAL"]),
    officerName: z.string().optional(),
    internalContact: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestingParty === "LAW_ENFORCEMENT" && !data.officerName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Officer name is required for law enforcement requests",
        path: ["officerName"],
      })
    }
    if (data.requestingParty === "INTERNAL" && !data.internalContact?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal contact / comments is required for internal requests",
        path: ["internalContact"],
      })
    }
    if (new Date(data.endDateTime) <= new Date(data.startDateTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date/time must be after start date/time",
        path: ["endDateTime"],
      })
    }
  })

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "footage:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Scope check: verify user has access to this location
  const locationIds = await getFootageLocationIds(session.user.id, role)
  if (locationIds !== null && !locationIds.includes(parsed.data.locationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const location = await db.location.findUnique({
    where: { id: parsed.data.locationId, deletedAt: null },
    select: { id: true },
  })
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 })

  const footageRequest = await db.footageRequest.create({
    data: {
      locationId: parsed.data.locationId,
      startDateTime: new Date(parsed.data.startDateTime),
      endDateTime: new Date(parsed.data.endDateTime),
      cameraArea: parsed.data.cameraArea,
      requestingParty: parsed.data.requestingParty,
      officerName: parsed.data.officerName?.trim() || null,
      internalContact: parsed.data.internalContact?.trim() || null,
      createdById: session.user.id,
    },
    include: FOOTAGE_INCLUDE,
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "footage_request",
    entityId: footageRequest.id,
    changes: {
      locationId: footageRequest.locationId,
      requestingParty: footageRequest.requestingParty,
      status: footageRequest.status,
    },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(footageRequest, { status: 201 })
}
