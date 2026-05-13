import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getTicketLocationIds } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import path from "path"
import fs from "fs/promises"
import type { Role } from "@prisma/client"

// POST /api/tickets/[id]/history — add a comment or attachment to ticket history
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "ticket:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: { id: true, locationId: true },
  })
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "ADMIN") {
    const locationIds = await getTicketLocationIds(session.user.id, role)
    if (locationIds && !locationIds.includes(ticket.locationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const formData = await request.formData()
  const comment = (formData.get("comment") as string | null) ?? null
  const file = formData.get("file") as File | null

  if (!comment && (!file || file.size === 0)) {
    return NextResponse.json({ error: "Provide a comment or file" }, { status: 400 })
  }

  if (file && file.size > 0) {
    const isVideo = file.type.startsWith("video/")
    const limitBytes = isVideo ? 75 * 1024 * 1024 : 50 * 1024 * 1024
    const limitLabel = isVideo ? "75 MB" : "50 MB"
    if (file.size > limitBytes) {
      return NextResponse.json({ error: `File must be ${limitLabel} or smaller` }, { status: 400 })
    }
  }

  let attachmentPath: string | null = null
  if (file && file.size > 0) {
    const dir = path.resolve(process.cwd(), "uploads", "tickets", ticket.id)
    await fs.mkdir(dir, { recursive: true })
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const dest = path.join(dir, safeName)
    await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()))
    attachmentPath = `${ticket.id}/${safeName}`
  }

  const entry = await db.ticketHistory.create({
    data: {
      ticketId: id,
      userId: session.user.id,
      comment,
      attachment: attachmentPath,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "ticket_history",
    entityId: entry.id,
    changes: { ticketId: id, hasComment: !!comment, hasAttachment: !!attachmentPath },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ entry }, { status: 201 })
}
