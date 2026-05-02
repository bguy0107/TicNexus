import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import type { Role, Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const userId = session.user.id

  if (role === "STORE_USER" || role === "TECHNICIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const baseWhere: Prisma.UserWhereInput = { deletedAt: null }

  if (role === "ADMIN") {
    const users = await db.user.findMany({
      where: baseWhere,
      select: userSelect,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ users })
  }

  if (role === "FRANCHISE_MANAGER") {
    const uf = await db.userFranchise.findFirst({ where: { userId } })
    if (!uf) return NextResponse.json({ users: [] })

    const locationIds = (
      await db.location.findMany({ where: { franchiseId: uf.franchiseId }, select: { id: true } })
    ).map((l) => l.id)

    const users = await db.user.findMany({
      where: {
        ...baseWhere,
        OR: [
          { userFranchises: { some: { franchiseId: uf.franchiseId } } },
          { userLocations: { some: { locationId: { in: locationIds } } } },
        ],
      },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ users })
  }

  if (role === "SUPERVISOR") {
    const uls = await db.userLocation.findMany({ where: { userId } })
    const locationIds = uls.map((ul) => ul.locationId)

    const users = await db.user.findMany({
      where: {
        ...baseWhere,
        role: "STORE_USER",
        userLocations: { some: { locationId: { in: locationIds } } },
      },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ users })
  }

  return NextResponse.json({ users: [] })
}

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  deletedAt: true,
  userFranchises: {
    select: { franchise: { select: { id: true, name: true } } },
  },
  userLocations: {
    select: {
      location: { select: { id: true, name: true, franchise: { select: { name: true } } } },
    },
  },
} as const
