import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"

const patchSchema = z.object({
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
    .or(z.literal(""))
    .optional(),
})

export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      phone: true,
      image: true,
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { phone } = parsed.data
  const actorId = session.user.id

  const current = await db.user.findUnique({ where: { id: actorId }, select: { phone: true } })
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.user.update({ where: { id: actorId }, data: { phone: phone ?? null } })

  await createAuditLog({
    actorId,
    action: "UPDATE",
    entityType: "user",
    entityId: actorId,
    changes: { before: { phone: current.phone }, after: { phone: phone ?? null } },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
