import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}
