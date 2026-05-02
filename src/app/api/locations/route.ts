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

  if (hasPermission(role, "location:read:all")) {
    const locations = await db.location.findMany({
      where: { deletedAt: null },
      include: { franchise: { select: { name: true } }, _count: { select: { userLocations: true } } },
      orderBy: [{ franchise: { name: "asc" } }, { name: "asc" }],
    })
    return NextResponse.json({ locations })
  }

  if (hasPermission(role, "location:read:own")) {
    if (role === "FRANCHISE_MANAGER") {
      const uf = await db.userFranchise.findFirst({ where: { userId } })
      if (!uf) return NextResponse.json({ locations: [] })
      const locations = await db.location.findMany({
        where: { franchiseId: uf.franchiseId, deletedAt: null },
        include: { franchise: { select: { name: true } }, _count: { select: { userLocations: true } } },
        orderBy: { name: "asc" },
      })
      return NextResponse.json({ locations })
    }

    const uls = await db.userLocation.findMany({ where: { userId } })
    const locationIds = uls.map((ul) => ul.locationId)
    const locations = await db.location.findMany({
      where: { id: { in: locationIds }, deletedAt: null },
      include: { franchise: { select: { name: true } }, _count: { select: { userLocations: true } } },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ locations })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  franchiseId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "location:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  if (role === "FRANCHISE_MANAGER") {
    const uf = await db.userFranchise.findFirst({ where: { userId: session.user.id } })
    if (!uf || uf.franchiseId !== parsed.data.franchiseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const location = await db.location.create({
    data: {
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      franchiseId: parsed.data.franchiseId,
      createdById: session.user.id,
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "location",
    entityId: location.id,
    changes: { name: location.name, franchiseId: location.franchiseId },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json(location, { status: 201 })
}
