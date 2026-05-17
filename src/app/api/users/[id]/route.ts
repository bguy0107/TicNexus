import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission, isHigherRole, canCreateRole } from "@/lib/permissions"
import {
  isTargetInFranchiseMgrScope,
  isTargetInLocationScope,
  getFranchiseMgrLocationIds,
  getFranchiseMgrFranchiseIds,
  getSupervisorLocationIds,
} from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import type { Role, Department } from "@prisma/client"

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  role: true,
  departments: true,
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

  // [C1] Require explicit update permission before rank check
  if (
    !hasPermission(actorRole, "user:update:any") &&
    !hasPermission(actorRole, "user:update:below")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  const body = await request.json()
  const {
    firstName,
    lastName,
    role,
    departments,
    addLocationIds,
    removeLocationIds,
    addFranchiseIds,
    removeFranchiseIds,
  } = body

  const effectiveRole: Role = role !== undefined ? (role as Role) : (target.role as Role)
  if (effectiveRole === "TECHNICIAN") {
    const effectiveDepts: Department[] =
      departments !== undefined ? departments : target.departments
    if (!effectiveDepts || effectiveDepts.length === 0) {
      return NextResponse.json(
        { error: "At least one department is required for Technician users" },
        { status: 400 }
      )
    }
  }

  const validDepartments: Department[] = ["IT", "MAINTENANCE"]
  if (departments !== undefined) {
    const invalid = (departments as string[]).filter(
      (d) => !validDepartments.includes(d as Department)
    )
    if (invalid.length > 0) {
      return NextResponse.json({ error: "Invalid department value" }, { status: 400 })
    }
  }

  if (role !== undefined && role !== target.role) {
    if (!hasPermission(actorRole, "user:update:role")) {
      return NextResponse.json({ error: "Forbidden: cannot change roles" }, { status: 403 })
    }
    if (!canCreateRole(actorRole, role as Role)) {
      return NextResponse.json({ error: "Forbidden: cannot assign that role" }, { status: 403 })
    }
  }

  const hasAssignmentChanges =
    addLocationIds?.length ||
    removeLocationIds?.length ||
    addFranchiseIds?.length ||
    removeFranchiseIds?.length

  if (hasAssignmentChanges) {
    if (!hasPermission(actorRole, "user:update:assignments")) {
      return NextResponse.json({ error: "Forbidden: cannot modify assignments" }, { status: 403 })
    }
    if (!isHigherRole(actorRole, target.role as Role)) {
      return NextResponse.json(
        { error: "Forbidden: cannot assign users of equal or higher rank" },
        { status: 403 }
      )
    }

    if (actorRole === "FRANCHISE_MANAGER") {
      const allowedLocations = await getFranchiseMgrLocationIds(actorId)
      const allowedFranchises = await getFranchiseMgrFranchiseIds(actorId)

      if (addLocationIds?.length) {
        const invalid = (addLocationIds as string[]).filter(
          (lid) => !allowedLocations.includes(lid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: location outside your franchise" },
            { status: 403 }
          )
        }
      }
      // [M3] Validate remove IDs against scope
      if (removeLocationIds?.length) {
        const invalid = (removeLocationIds as string[]).filter(
          (lid) => !allowedLocations.includes(lid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: location outside your franchise" },
            { status: 403 }
          )
        }
      }
      // [C3] Validate franchise add/remove against scope
      if (addFranchiseIds?.length) {
        const invalid = (addFranchiseIds as string[]).filter(
          (fid) => !allowedFranchises.includes(fid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: franchise outside your scope" },
            { status: 403 }
          )
        }
      }
      if (removeFranchiseIds?.length) {
        const invalid = (removeFranchiseIds as string[]).filter(
          (fid) => !allowedFranchises.includes(fid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: franchise outside your scope" },
            { status: 403 }
          )
        }
      }
    }

    if (actorRole === "SUPERVISOR") {
      const allowedLocations = await getSupervisorLocationIds(actorId)

      if (addLocationIds?.length) {
        const invalid = (addLocationIds as string[]).filter(
          (lid) => !allowedLocations.includes(lid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: location outside your scope" },
            { status: 403 }
          )
        }
      }
      // [M3] Validate remove IDs against scope
      if (removeLocationIds?.length) {
        const invalid = (removeLocationIds as string[]).filter(
          (lid) => !allowedLocations.includes(lid)
        )
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: location outside your scope" },
            { status: 403 }
          )
        }
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
  if (departments !== undefined) {
    const prev = target.departments as Department[]
    const next = departments as Department[]
    const changed = prev.length !== next.length || prev.some((d) => !next.includes(d))
    if (changed) {
      before.departments = prev
      after.departments = next
      userUpdates.departments = next
    }
  }

  await db.$transaction(async (tx) => {
    if (Object.keys(userUpdates).length > 0) {
      await tx.user.update({ where: { id }, data: userUpdates })
    }

    if (addLocationIds?.length) {
      await tx.userLocation.createMany({
        data: (addLocationIds as string[]).map((locationId) => ({
          userId: id,
          locationId,
          assignedById: actorId,
        })),
        skipDuplicates: true,
      })
      after.addedLocationIds = addLocationIds
    }
    if (removeLocationIds?.length) {
      await tx.userLocation.deleteMany({
        where: { userId: id, locationId: { in: removeLocationIds as string[] } },
      })
      after.removedLocationIds = removeLocationIds
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
      after.addedFranchiseIds = addFranchiseIds
    }
    if (removeFranchiseIds?.length) {
      await tx.userFranchise.deleteMany({
        where: { userId: id, franchiseId: { in: removeFranchiseIds as string[] } },
      })
      after.removedFranchiseIds = removeFranchiseIds
    }
  })

  // [H2] Gate on `after` so assignment-only changes are logged
  if (Object.keys(after).length > 0) {
    await createAuditLog({
      actorId,
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      changes: { before, after },
      ipAddress: getIpFromRequest(request),
    })
  }

  const updated = await db.user.findUnique({ where: { id }, select: userSelect })
  return NextResponse.json(updated)
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

  // [C1] Require explicit deactivate permission
  if (
    !hasPermission(actorRole, "user:deactivate:any") &&
    !hasPermission(actorRole, "user:deactivate:below")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  // [C2] Revoke all active sessions for the deactivated user
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deletedAt: new Date() } })
    await tx.session.deleteMany({ where: { userId: id } })
  })

  await createAuditLog({
    actorId,
    action: "DEACTIVATE",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
