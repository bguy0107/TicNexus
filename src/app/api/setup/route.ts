import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"

export async function GET() {
  const adminCount = await db.user.count({ where: { role: "ADMIN" } })
  return NextResponse.json({ needsSetup: adminCount === 0 })
}

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  const adminCount = await db.user.count({ where: { role: "ADMIN" } })
  if (adminCount > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, email, password } = parsed.data

  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const signUpResponse = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: `${firstName} ${lastName}`,
    },
  })

  if (!signUpResponse || !signUpResponse.user) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }

  await db.user.update({
    where: { id: signUpResponse.user.id },
    data: { firstName, lastName, role: "ADMIN", emailVerified: true },
  })

  await createAuditLog({
    actorId: signUpResponse.user.id,
    action: "CREATE",
    entityType: "user",
    entityId: signUpResponse.user.id,
    changes: { role: "ADMIN", email },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
