import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getApiSession } from "@/lib/session"
import { sendInvitationEmail } from "@/lib/email"
import { createAuditLog } from "@/lib/audit"
import {
  getFranchiseMgrFranchiseIds,
  getFranchiseMgrLocationIds,
  getSupervisorLocationIds,
} from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { randomUUID } from "crypto"
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

export async function POST(
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

  // Issue a fresh token and extend expiry 48 hours from now
  const newToken = randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await db.invitation.update({
    where: { token },
    data: { token: newToken, expiresAt },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${newToken}`
  const inviterName = session.user.name ?? "TicNexus"

  await sendInvitationEmail({ to: invitation.email, inviterName, role: invitation.role, inviteUrl })

  await createAuditLog({
    actorId,
    action: "INVITE_SENT",
    entityType: "invitation",
    entityId: invitation.id,
    changes: { email: invitation.email, role: invitation.role, resent: true },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
