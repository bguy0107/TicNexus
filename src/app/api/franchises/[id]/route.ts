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
      _count: { select: { userFranchises: true } },
    },
  })

  if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(franchise)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(session.user.role as Role, "franchise:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await db.franchise.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.franchise.update({
    where: { id },
    data: { name: parsed.data.name },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "franchise",
    entityId: id,
    changes: { before: { name: existing.name }, after: { name: updated.name } },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(session.user.role as Role, "franchise:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.franchise.findUnique({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.franchise.update({ where: { id }, data: { deletedAt: new Date() } })

  await createAuditLog({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "franchise",
    entityId: id,
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
