import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
  if (invitation.acceptedAt) return NextResponse.json({ error: "Invitation already accepted" }, { status: 410 })
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Invitation has expired" }, { status: 410 })

  return NextResponse.json(invitation)
}

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invitation = await db.invitation.findUnique({ where: { token } })
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  if (invitation.acceptedAt) return NextResponse.json({ error: "Already accepted" }, { status: 410 })
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, password } = parsed.data

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

  const userId = signUpResponse.user.id

  await db.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      role: invitation.role,
      emailVerified: true,
      createdById: invitation.invitedById,
    },
  })

  if (invitation.franchiseId && ["FRANCHISE_MANAGER"].includes(invitation.role)) {
    await db.userFranchise.create({
      data: { userId, franchiseId: invitation.franchiseId, assignedById: invitation.invitedById },
    })
  }

  if (invitation.locationId) {
    await db.userLocation.create({
      data: { userId, locationId: invitation.locationId, assignedById: invitation.invitedById },
    })
  }

  await db.invitation.update({
    where: { token },
    data: { acceptedAt: new Date() },
  })

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
