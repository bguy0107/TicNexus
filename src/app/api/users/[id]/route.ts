import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission, isHigherRole, canCreateRole } from "@/lib/permissions"
import {
  isTargetInFranchiseMgrScope,
  isTargetInLocationScope,
  getFranchiseMgrLocationIds,
  getSupervisorLocationIds,
} from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import type { Role } from "@prisma/client"

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  deletedAt: true,
  userFranchises: { select: { franchise: { select: { id: true, name: true } } } },
  userLocations: {
    select: {
      location: { select: { id: true, name: true, franchise: { select: { name: true } } } },
    },
  },
} as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role
  const actorId = session.user.id

  const user = await db.user.findUnique({ where: { id, deletedAt: null }, select: userSelect })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (actorRole !== "ADMIN") {
    if (id !== actorId) {
      if (actorRole === "FRANCHISE_MANAGER") {
        if (!(await isTargetInFranchiseMgrScope(actorId, id))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } else {
        // SUPERVISOR, TECHNICIAN, STORE_USER: target must share a location
        if (!(await isTargetInLocationScope(actorId, id))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
    }
  }

  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role
  const actorId = session.user.id

  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role) && actorRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Scope check for non-admins
  if (actorRole === "FRANCHISE_MANAGER") {
    if (!(await isTargetInFranchiseMgrScope(actorId, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else if (actorRole === "SUPERVISOR") {
    if (!(await isTargetInLocationScope(actorId, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const body = await request.json()
  const {
    firstName,
    lastName,
    role,
    addLocationIds,
    removeLocationIds,
    addFranchiseIds,
    removeFranchiseIds,
  } = body

  // Role change: requires user:update:role and the new role must be one actor can create
  if (role !== undefined && role !== target.role) {
    if (!hasPermission(actorRole, "user:update:role")) {
      return NextResponse.json({ error: "Forbidden: cannot change roles" }, { status: 403 })
    }
    if (!canCreateRole(actorRole, role as Role)) {
      return NextResponse.json({ error: "Forbidden: cannot assign that role" }, { status: 403 })
    }
  }

  // Assignment changes: requires user:update:assignments, and locations must be within actor's scope
  const hasAssignmentChanges =
    addLocationIds?.length ||
    removeLocationIds?.length ||
    addFranchiseIds?.length ||
    removeFranchiseIds?.length

  if (hasAssignmentChanges) {
    if (!hasPermission(actorRole, "user:update:assignments")) {
      return NextResponse.json({ error: "Forbidden: cannot modify assignments" }, { status: 403 })
    }

    if (actorRole === "FRANCHISE_MANAGER" && addLocationIds?.length) {
      const allowed = await getFranchiseMgrLocationIds(actorId)
      const invalid = (addLocationIds as string[]).filter((lid) => !allowed.includes(lid))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Forbidden: location outside your franchise" },
          { status: 403 }
        )
      }
    }

    if (actorRole === "SUPERVISOR" && addLocationIds?.length) {
      const allowed = await getSupervisorLocationIds(actorId)
      const invalid = (addLocationIds as string[]).filter((lid) => !allowed.includes(lid))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Forbidden: location outside your scope" },
          { status: 403 }
        )
      }
    }
  }

  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  const userUpdates: Record<string, unknown> = {}
  if (firstName) {
    before.firstName = target.firstName
    after.firstName = firstName
    userUpdates.firstName = firstName
  }
  if (lastName) {
    before.lastName = target.lastName
    after.lastName = lastName
    userUpdates.lastName = lastName
  }
  if (firstName || lastName) {
    userUpdates.name = `${firstName ?? target.firstName} ${lastName ?? target.lastName}`
  }
  if (role !== undefined && role !== target.role) {
    before.role = target.role
    after.role = role
    userUpdates.role = role
  }

  const updatedUser = await db.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: userUpdates })

    if (addLocationIds?.length) {
      await tx.userLocation.createMany({
        data: (addLocationIds as string[]).map((locationId) => ({
          userId: id,
          locationId,
          assignedById: actorId,
        })),
        skipDuplicates: true,
      })
    }
    if (removeLocationIds?.length) {
      await tx.userLocation.deleteMany({
        where: { userId: id, locationId: { in: removeLocationIds as string[] } },
      })
    }
    if (addFranchiseIds?.length) {
      await tx.userFranchise.createMany({
        data: (addFranchiseIds as string[]).map((franchiseId) => ({
          userId: id,
          franchiseId,
          assignedById: actorId,
        })),
        skipDuplicates: true,
      })
    }
    if (removeFranchiseIds?.length) {
      await tx.userFranchise.deleteMany({
        where: { userId: id, franchiseId: { in: removeFranchiseIds as string[] } },
      })
    }

    return user
  })

  if (Object.keys(before).length > 0) {
    await createAuditLog({
      actorId,
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      changes: { before, after },
      ipAddress: getIpFromRequest(request),
    })
  }

  return NextResponse.json(updatedUser)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role
  const actorId = session.user.id

  if (id === actorId) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role) && actorRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (actorRole === "FRANCHISE_MANAGER") {
    if (!(await isTargetInFranchiseMgrScope(actorId, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else if (actorRole === "SUPERVISOR") {
    if (!(await isTargetInLocationScope(actorId, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  await db.user.update({ where: { id }, data: { deletedAt: new Date() } })

  await createAuditLog({
    actorId,
    action: "DEACTIVATE",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
