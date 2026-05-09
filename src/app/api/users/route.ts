import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import type { Role, Department, Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const userId = session.user.id

  const deactivated = request.nextUrl.searchParams.get("deactivated") === "true"
  const baseWhere: Prisma.UserWhereInput = deactivated
    ? { deletedAt: { not: null } }
    : { deletedAt: null }

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
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { email, firstName, lastName, role, password, department, franchiseId, locationId } =
    body as {
      email?: string
      firstName?: string
      lastName?: string
      role?: string
      password?: string
      department?: string
      franchiseId?: string
      locationId?: string
    }

  if (!email || !firstName || !lastName || !role || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing)
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })

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

  const actorId = session.user.id
  const userId = result.user.id

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: role as Role,
        department: department ? (department as Department) : undefined,
        emailVerified: true,
        firstName,
        lastName,
        mustChangePassword: true,
        createdById: actorId,
      },
    })
    if (franchiseId) {
      await tx.userFranchise.create({
        data: { userId, franchiseId, assignedById: actorId },
      })
    }
    if (locationId) {
      await tx.userLocation.create({
        data: { userId, locationId, assignedById: actorId },
      })
    }
  })

  await createAuditLog({
    actorId,
    action: "CREATE",
    entityType: "user",
    entityId: userId,
    changes: {
      email,
      firstName,
      lastName,
      role,
      ...(department && { department }),
      ...(franchiseId && { franchiseId }),
      ...(locationId && { locationId }),
    },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ user: result.user }, { status: 201 })
}
