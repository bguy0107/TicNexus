import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission, isHigherRole } from "@/lib/permissions"
import { getFranchiseMgrLocationIds } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const role = session.user.role as Role
  const userId = session.user.id

  // [H3] Enforce read scope on individual location fetch
  if (!hasPermission(role, "location:read:all")) {
    if (role === "FRANCHISE_MANAGER") {
      const allowed = await getFranchiseMgrLocationIds(userId)
      if (!allowed.includes(id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      const ul = await db.userLocation.findFirst({ where: { userId, locationId: id } })
      if (!ul) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const location = await db.location.findUnique({
    where: { id, deletedAt: null },
    include: {
      franchise: { select: { id: true, name: true } },
      userLocations: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              deletedAt: true,
            },
          },
        },
      },
      _count: { select: { userLocations: true } },
    },
  })

  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(location)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  locationNumber: z.string().optional(),
  franchiseId: z.string().optional(),
  addUserIds: z.array(z.string()).optional(),
  removeUserIds: z.array(z.string()).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const userId = session.user.id
  const isAdmin = role === "ADMIN"
  const canUpdateLocation = hasPermission(role, "location:update")
  const canUpdateAssignments = hasPermission(role, "user:update:assignments")

  if (!canUpdateLocation && !canUpdateAssignments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, address, locationNumber, franchiseId, addUserIds, removeUserIds } = parsed.data

  const hasFieldChanges =
    name !== undefined ||
    address !== undefined ||
    locationNumber !== undefined ||
    franchiseId !== undefined
  const hasAdminOnlyFields = locationNumber !== undefined || franchiseId !== undefined
  const hasAssignmentChanges = addUserIds?.length || removeUserIds?.length

  if (hasFieldChanges && !canUpdateLocation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (hasAdminOnlyFields && !isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: only admins can change location ID or franchise" },
      { status: 403 }
    )
  }
  if (hasAssignmentChanges && !canUpdateAssignments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await db.location.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Scope check
  if (!isAdmin) {
    if (role === "FRANCHISE_MANAGER") {
      const allowed = await getFranchiseMgrLocationIds(userId)
      if (!allowed.includes(id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      const ul = await db.userLocation.findFirst({ where: { userId, locationId: id } })
      if (!ul) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (addUserIds?.length) {
    const targetUsers = await db.user.findMany({
      where: { id: { in: addUserIds }, deletedAt: null },
      select: { id: true, role: true },
    })
    const outOfRank = targetUsers.filter(
      (u) => !isHigherRole(session.user.role as Role, u.role as Role)
    )
    if (outOfRank.length > 0) {
      return NextResponse.json(
        { error: "Forbidden: cannot assign users of equal or higher rank" },
        { status: 403 }
      )
    }
  }

  const hasAssignmentEdit = !!(addUserIds?.length || removeUserIds?.length)

  const existingUserIds = hasAssignmentEdit
    ? (await db.userLocation.findMany({ where: { locationId: id }, select: { userId: true } })).map(
        (ul) => ul.userId
      )
    : []

  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  await db.$transaction(async (tx) => {
    const locationUpdates: Record<string, unknown> = {}
    if (name && name !== existing.name) {
      before.name = existing.name
      after.name = name
      locationUpdates.name = name
    }
    if (address !== undefined && address !== existing.address) {
      before.address = existing.address
      after.address = address
      locationUpdates.address = address
    }
    if (locationNumber !== undefined && locationNumber !== existing.locationNumber) {
      before.locationNumber = existing.locationNumber
      after.locationNumber = locationNumber
      locationUpdates.locationNumber = locationNumber
    }
    if (franchiseId && franchiseId !== existing.franchiseId) {
      before.franchiseId = existing.franchiseId
      after.franchiseId = franchiseId
      locationUpdates.franchiseId = franchiseId
    }

    if (Object.keys(locationUpdates).length > 0) {
      await tx.location.update({ where: { id }, data: locationUpdates })
    }

    if (addUserIds?.length) {
      await tx.userLocation.createMany({
        data: addUserIds.map((userId) => ({
          userId,
          locationId: id,
          assignedById: session.user.id,
        })),
        skipDuplicates: true,
      })
    }

    if (removeUserIds?.length) {
      await tx.userLocation.deleteMany({ where: { locationId: id, userId: { in: removeUserIds } } })
    }

    if (hasAssignmentEdit) {
      before.userIds = existingUserIds
      after.userIds = [
        ...existingUserIds.filter((uid) => !removeUserIds?.includes(uid)),
        ...(addUserIds ?? []),
      ]
    }
  })

  if (Object.keys(after).length > 0) {
    await createAuditLog({
      actorId: session.user.id,
      action: "UPDATE",
      entityType: "location",
      entityId: id,
      changes: { before, after },
      ipAddress: getIpFromRequest(request),
    })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(session.user.role as Role, "location:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.location.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.location.update({ where: { id }, data: { deletedAt: new Date() } })

  await createAuditLog({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "location",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
