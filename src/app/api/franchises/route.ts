import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const userId = session.user.id

  if (hasPermission(role, "franchise:read:all")) {
    const franchises = await db.franchise.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { locations: true, userFranchises: true } } },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ franchises })
  }

  if (hasPermission(role, "franchise:read:own")) {
    if (role === "FRANCHISE_MANAGER") {
      const uf = await db.userFranchise.findFirst({
        where: { userId },
        include: {
          franchise: {
            include: { _count: { select: { locations: true, userFranchises: true } } },
          },
        },
      })
      return NextResponse.json({ franchises: uf ? [uf.franchise] : [] })
    }

    const uls = await db.userLocation.findMany({
      where: { userId },
      include: { location: { include: { franchise: true } } },
    })
    const seen = new Set<string>()
    const franchises = uls
      .map((ul) => ul.location.franchise)
      .filter((f) => {
        if (seen.has(f.id)) return false
        seen.add(f.id)
        return !f.deletedAt
      })
    return NextResponse.json({ franchises })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

const createSchema = z.object({
  name: z.string().min(1, "Franchise name is required"),
})

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(session.user.role as Role, "franchise:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const franchise = await db.franchise.create({
    data: { name: parsed.data.name, createdById: session.user.id },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "franchise",
    entityId: franchise.id,
    changes: { name: franchise.name },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(franchise, { status: 201 })
}
