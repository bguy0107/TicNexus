import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import { hashPassword, verifyPassword } from "@better-auth/utils/password"
import { z } from "zod"

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getApiSession(request.headers)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data
    const userId = session.user.id

    const account = await db.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { password: true },
    })
    if (!account?.password) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, account.password)
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    const hashed = await hashPassword(newPassword)

    // Atomically update password, clear mustChangePassword, and revoke other sessions
    await db.$transaction(async (tx) => {
      await tx.account.updateMany({
        where: { userId, providerId: "credential" },
        data: { password: hashed },
      })
      await tx.user.update({
        where: { id: userId },
        data: { mustChangePassword: false },
      })
      await tx.session.deleteMany({
        where: { userId, token: { not: session.session.token } },
      })
    })

    await createAuditLog({
      actorId: userId,
      action: "PASSWORD_RESET",
      entityType: "user",
      entityId: userId,
      ipAddress: getIpFromRequest(request),
    })

    // Clear the Better-Auth session_data cache cookie so the next request re-reads
    // mustChangePassword from the DB rather than returning the stale cached value.
    const response = NextResponse.json({ success: true })
    response.cookies.delete("better-auth.session_data")
    return response
  } catch (err) {
    console.error("[change-password] unhandled error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
