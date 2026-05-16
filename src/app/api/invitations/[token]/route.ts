import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getApiSession } from "@/lib/session"
import { createAuditLog } from "@/lib/audit"
import {
  getFranchiseMgrFranchiseIds,
  getFranchiseMgrLocationIds,
  getSupervisorLocationIds,
} from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

async function isInvitationInScope(
  actorRole: Role,
  actorId: string,
  invitation: { invitedById: string; franchiseId: string | null; locationId: string | null }
): Promise<boolean> {
  if (invitation.invitedById === actorId) return true
  if (actorRole === "FRANCHISE_MANAGER") {
    const [franchiseIds, locationIds] = await Promise.all([
      getFranchiseMgrFranchiseIds(actorId),
      getFranchiseMgrLocationIds(actorId),
    ])
    return (
      (invitation.franchiseId !== null && franchiseIds.includes(invitation.franchiseId)) ||
      (invitation.locationId !== null && locationIds.includes(invitation.locationId))
    )
  }
  if (actorRole === "SUPERVISOR") {
    const locationIds = await getSupervisorLocationIds(actorId)
    return invitation.locationId !== null && locationIds.includes(invitation.locationId)
  }
  return false
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invitation = await db.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      franchise: { select: { name: true } },
      location: { select: { name: true } },
    },
  })

  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  if (invitation.acceptedAt)
    return NextResponse.json({ error: "Invitation already accepted" }, { status: 410 })
  if (invitation.expiresAt < new Date())
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 })

  return NextResponse.json(invitation)
}

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invitation = await db.invitation.findUnique({ where: { token } })
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  if (invitation.acceptedAt)
    return NextResponse.json({ error: "Already accepted" }, { status: 410 })
  if (invitation.expiresAt < new Date())
    return NextResponse.json({ error: "Expired" }, { status: 410 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, password } = parsed.data

  // [H4] signUpEmail throws on duplicate email; return 409
  let userId: string
  try {
    const signUpResponse = await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        password,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
      },
    })
    if (!signUpResponse?.user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
    }
    userId = signUpResponse.user.id
  } catch {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    )
  }

  // [H4] Wrap all post-signup writes in a transaction; compensate on failure
  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          role: invitation.role,
          departments: invitation.department ? [invitation.department] : [],
          emailVerified: true,
          createdById: invitation.invitedById,
        },
      })

      if (invitation.franchiseId && invitation.role === "FRANCHISE_MANAGER") {
        await tx.userFranchise.create({
          data: {
            userId,
            franchiseId: invitation.franchiseId,
            assignedById: invitation.invitedById,
          },
        })
      }

      if (invitation.locationId) {
        await tx.userLocation.create({
          data: {
            userId,
            locationId: invitation.locationId,
            assignedById: invitation.invitedById,
          },
        })
      }

      await tx.invitation.update({ where: { token }, data: { acceptedAt: new Date() } })
    })
  } catch {
    await db.user.delete({ where: { id: userId } }).catch(() => null)
    return NextResponse.json({ error: "Failed to complete account setup" }, { status: 500 })
  }

  await createAuditLog({
    actorId: userId,
    action: "INVITE_ACCEPTED",
    entityType: "invitation",
    entityId: invitation.id,
    changes: { email: invitation.email, role: invitation.role },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await params
  const actorRole = session.user.role as Role
  const actorId = session.user.id

  const invitation = await db.invitation.findUnique({ where: { token } })
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (invitation.acceptedAt)
    return NextResponse.json({ error: "Invitation already accepted" }, { status: 400 })

  if (actorRole !== "ADMIN") {
    const allowed = await isInvitationInScope(actorRole, actorId, invitation)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.invitation.delete({ where: { token } })

  await createAuditLog({
    actorId,
    action: "DELETE",
    entityType: "invitation",
    entityId: invitation.id,
    changes: { email: invitation.email, role: invitation.role },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
