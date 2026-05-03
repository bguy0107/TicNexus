import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission, isHigherRole } from "@/lib/permissions"
import { isTargetInFranchiseMgrScope, isTargetInLocationScope } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import type { Role } from "@prisma/client"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role
  const actorId = session.user.id

  if (
    !hasPermission(actorRole, "user:reactivate:any") &&
    !hasPermission(actorRole, "user:reactivate:below")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // findUnique without deletedAt filter so we can find deactivated users
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!target.deletedAt)
    return NextResponse.json({ error: "User is already active" }, { status: 400 })

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

  await db.user.update({ where: { id }, data: { deletedAt: null } })

  await createAuditLog({
    actorId,
    action: "REACTIVATE",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
