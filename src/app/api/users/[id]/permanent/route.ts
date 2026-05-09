import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission, isHigherRole } from "@/lib/permissions"
import { isTargetInFranchiseMgrScope, isTargetInLocationScope } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import type { Role } from "@prisma/client"

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
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  if (
    !hasPermission(actorRole, "user:delete:any") &&
    !hasPermission(actorRole, "user:delete:below")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!target.deletedAt) {
    return NextResponse.json(
      { error: "User must be deactivated before permanent deletion" },
      { status: 400 }
    )
  }

  if (
    !hasPermission(actorRole, "user:delete:any") &&
    !isHigherRole(actorRole, target.role as Role)
  ) {
    return NextResponse.json(
      { error: "Forbidden: cannot delete a user of equal or higher role" },
      { status: 403 }
    )
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

  const targetName = `${target.firstName} ${target.lastName}`.trim() || target.email

  await db.$transaction(async (tx) => {
    // Remove FK-constrained records that have no cascade delete
    await tx.invitation.deleteMany({ where: { invitedById: id } })
    await tx.auditLog.deleteMany({ where: { actorId: id } })
    await tx.user.updateMany({ where: { createdById: id }, data: { createdById: null } })
    // Session, Account, UserFranchise, UserLocation cascade automatically
    await tx.user.delete({ where: { id } })
  })

  await createAuditLog({
    actorId,
    action: "DELETE",
    entityType: "user",
    entityId: id,
    changes: { name: targetName, email: target.email, role: target.role },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
