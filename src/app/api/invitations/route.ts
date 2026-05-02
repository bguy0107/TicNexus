import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { sendInvitationEmail } from "@/lib/email"
import { createAuditLog } from "@/lib/audit"
import { canCreateRole } from "@/lib/permissions"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role } from "@prisma/client"

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"]),
  franchiseId: z.string().optional(),
  locationId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actorRole = session.user.role as Role

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { email, role, franchiseId, locationId } = parsed.data

  if (!canCreateRole(actorRole, role as Role)) {
    return NextResponse.json({ error: "You cannot invite users with that role" }, { status: 403 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })
  }

  const pendingInvite = await db.invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  if (pendingInvite) {
    return NextResponse.json({ error: "An active invitation already exists for this email" }, { status: 409 })
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const invitation = await db.invitation.create({
    data: {
      email,
      role: role as Role,
      franchiseId: franchiseId ?? null,
      locationId: locationId ?? null,
      invitedById: session.user.id,
      expiresAt,
    },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`
  const inviterName = `${session.user.name}`

  await sendInvitationEmail({ to: email, inviterName, role, inviteUrl })

  await createAuditLog({
    actorId: session.user.id,
    action: "INVITE_SENT",
    entityType: "invitation",
    entityId: invitation.id,
    changes: { email, role },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true, invitationId: invitation.id })
}

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invitations = await db.invitation.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { firstName: true, lastName: true } },
      franchise: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ invitations })
}
