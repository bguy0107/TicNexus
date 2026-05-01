import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { isHigherRole } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import type { Role } from "@prisma/client"

async function getAuthorizedSession(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  return session
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthorizedSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = await db.user.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, name: true,
      email: true, role: true, createdAt: true, deletedAt: true,
      userFranchises: { select: { franchise: { select: { id: true, name: true } } } },
      userLocations: { select: { location: { select: { id: true, name: true, franchise: { select: { name: true } } } } } },
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthorizedSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role

  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role) && actorRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { firstName, lastName } = body

  const before = { firstName: target.firstName, lastName: target.lastName }
  const updated = await db.user.update({
    where: { id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(firstName || lastName
        ? { name: `${firstName ?? target.firstName} ${lastName ?? target.lastName}` }
        : {}),
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    changes: { before, after: { firstName: updated.firstName, lastName: updated.lastName } },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthorizedSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const actorRole = session.user.role as Role

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { id, deletedAt: null } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isHigherRole(actorRole, target.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.user.update({ where: { id }, data: { deletedAt: new Date() } })

  await createAuditLog({
    actorId: session.user.id,
    action: "DEACTIVATE",
    entityType: "user",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
