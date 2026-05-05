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
    !hasPermission(actorRole, "user:reset-password:any") &&
    !hasPermission(actorRole, "user:reset-password:below")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role)) {
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

  await db.user.update({ where: { id }, data: { mustChangePassword: true } })

  await createAuditLog({
    actorId,
    action: "PASSWORD_RESET",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
