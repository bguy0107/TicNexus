import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import type { Role, Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const userId = session.user.id

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
    const ufs = await db.userFranchise.findMany({ where: { userId } })
    if (ufs.length === 0) return NextResponse.json({ users: [] })

    const franchiseIds = ufs.map((uf) => uf.franchiseId)
    const locationIds = (
      await db.location.findMany({
        where: { franchiseId: { in: franchiseIds } },
        select: { id: true },
      })
    ).map((l) => l.id)

    const users = await db.user.findMany({
      where: {
        ...baseWhere,
        OR: [
          { userFranchises: { some: { franchiseId: { in: franchiseIds } } } },
          { userLocations: { some: { locationId: { in: locationIds } } } },
        ],
      },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ users })
  }

  if (role === "SUPERVISOR" || role === "TECHNICIAN" || role === "STORE_USER") {
    const uls = await db.userLocation.findMany({ where: { userId } })
    const locationIds = uls.map((ul) => ul.locationId)
    if (locationIds.length === 0) return NextResponse.json({ users: [] })

    const users = await db.user.findMany({
      where: {
        ...baseWhere,
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
  department: true,
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

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { email, firstName, lastName, role, password } = body as {
    email?: string
    firstName?: string
    lastName?: string
    role?: string
    password?: string
  }

  if (!email || !firstName || !lastName || !role || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })

  const result = await auth.api.signUpEmail({
    body: {
      email: email.toLowerCase(),
      password,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
    },
  })

  if (!result?.user) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }

  await db.user.update({
    where: { id: result.user.id },
    data: {
      role: role as Role,
      emailVerified: true,
      firstName,
      lastName,
      mustChangePassword: true,
      createdById: session.user.id,
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "user",
    entityId: result.user.id,
    changes: { email, firstName, lastName, role },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ user: result.user }, { status: 201 })
}
