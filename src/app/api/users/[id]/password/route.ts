import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { isHigherRole } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import { hashPassword } from "@better-auth/utils/password"
import type { Role } from "@prisma/client"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actorRole = session.user.role as Role
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role)) {
    return NextResponse.json(
      { error: "Cannot change password of a user with equal or higher role" },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { password } = body as { password?: string }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const hashed = await hashPassword(password)

  await db.account.updateMany({
    where: { userId: id, providerId: "credential" },
    data: { password: hashed },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "PASSWORD_RESET",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
