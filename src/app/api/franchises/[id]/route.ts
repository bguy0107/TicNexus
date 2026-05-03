import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const franchise = await db.franchise.findUnique({
    where: { id, deletedAt: null },
    include: {
      locations: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      userFranchises: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { userFranchises: true } },
    },
  })

  if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(franchise)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  addManagerIds: z.array(z.string()).optional(),
  removeManagerIds: z.array(z.string()).optional(),
  addLocations: z
    .array(
      z.object({
        name: z.string().min(1),
        locationNumber: z.string().min(1),
        address: z.string().optional(),
      })
    )
    .optional(),
  removeLocationIds: z.array(z.string()).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(session.user.role as Role, "franchise:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await db.franchise.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { name, addManagerIds, removeManagerIds, addLocations, removeLocationIds } = parsed.data
  const actorId = session.user.id
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  await db.$transaction(async (tx) => {
    if (name && name !== existing.name) {
      before.name = existing.name
      after.name = name
      await tx.franchise.update({ where: { id }, data: { name } })
    }

    if (addManagerIds?.length) {
      await tx.userFranchise.createMany({
        data: addManagerIds.map((userId) => ({ userId, franchiseId: id, assignedById: actorId })),
        skipDuplicates: true,
      })
      after.addedManagerIds = addManagerIds
    }

    if (removeManagerIds?.length) {
      await tx.userFranchise.deleteMany({
        where: { franchiseId: id, userId: { in: removeManagerIds } },
      })
      after.removedManagerIds = removeManagerIds
    }

    if (addLocations?.length) {
      await tx.location.createMany({
        data: addLocations.map((l) => ({
          name: l.name,
          locationNumber: l.locationNumber,
          address: l.address ?? null,
          franchiseId: id,
        })),
      })
      after.addedLocations = addLocations.map((l) => l.name)
    }

    if (removeLocationIds?.length) {
      await tx.location.updateMany({
        where: { id: { in: removeLocationIds }, franchiseId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      after.removedLocationIds = removeLocationIds
    }
  })

  if (Object.keys(after).length > 0) {
    await createAuditLog({
      actorId,
      action: "UPDATE",
      entityType: "franchise",
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

  if (!hasPermission(session.user.role as Role, "franchise:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.franchise.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date()

  await db.$transaction(async (tx) => {
    await tx.location.updateMany({
      where: { franchiseId: id, deletedAt: null },
      data: { deletedAt: now },
    })
    await tx.franchise.update({ where: { id }, data: { deletedAt: now } })
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "franchise",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
