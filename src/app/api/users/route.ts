import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
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

  // [M6] Use hasPermission instead of inline role comparisons
  if (hasPermission(role, "user:read:all")) {
    const users = await db.user.findMany({
      where: baseWhere,
      select: userSelect,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ users })
  }

  if (hasPermission(role, "user:read:franchise")) {
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

  if (hasPermission(role, "user:read:location")) {
    const uls = await db.userLocation.findMany({ where: { userId } })
    const locationIds = uls.map((ul) => ul.locationId)
    if (locationIds.length === 0) return NextResponse.json({ users: [] })

    const users = await db.user.findMany({
      where: {
        ...baseWhere,
        OR: [
          { userLocations: { some: { locationId: { in: locationIds } } } },
          // Also include TECHNICIAN/STORE_USER with no location assignments so
          // supervisors can assign them to their locations.
          { userLocations: { none: {} }, role: { in: ["TECHNICIAN", "STORE_USER"] } },
        ],
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

// [L2] Zod schema for direct user creation
const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  department: z.enum(["IT", "MAINTENANCE"]).optional(),
  franchiseId: z.string().optional(),
  locationId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { email, firstName, lastName, role, password, department, franchiseId, locationId } =
    parsed.data

  // [H4] signUpEmail can throw on duplicate email; catch and return 409
  let userId: string
  try {
    // [M5] Remove pre-flight findUnique check (TOCTOU race); rely on signUpEmail uniqueness enforcement
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
    userId = result.user.id
  } catch {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })
  }

  const actorId = session.user.id

  try {
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
  } catch {
    // [H4] Compensate: remove the Better-Auth user to avoid orphaned records
    await db.user.delete({ where: { id: userId } }).catch(() => null)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }

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

  return NextResponse.json({ userId }, { status: 201 })
}
