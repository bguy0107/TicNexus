import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { getIpFromRequest } from "@/lib/utils"
import { writeFile, unlink, mkdir } from "fs/promises"
import path from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars")

function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }
  return map[mime] ?? "jpg"
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("avatar")

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 })
  }

  const actorId = session.user.id
  const ext = extForMime(file.type)
  const filename = `${actorId}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)

  await mkdir(UPLOAD_DIR, { recursive: true })

  // Remove old avatar file(s) for this user (any extension)
  const current = await db.user.findUnique({ where: { id: actorId }, select: { image: true } })
  if (current?.image) {
    const oldFilename = path.basename(current.image)
    const oldPath = path.join(UPLOAD_DIR, oldFilename)
    await unlink(oldPath).catch(() => null)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const imageUrl = `/uploads/avatars/${filename}`
  await db.user.update({ where: { id: actorId }, data: { image: imageUrl } })

  await createAuditLog({
    actorId,
    action: "UPDATE",
    entityType: "user",
    entityId: actorId,
    changes: { before: { image: current?.image ?? null }, after: { image: imageUrl } },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ imageUrl })
}

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actorId = session.user.id
  const current = await db.user.findUnique({ where: { id: actorId }, select: { image: true } })

  if (current?.image) {
    const oldPath = path.join(UPLOAD_DIR, path.basename(current.image))
    await unlink(oldPath).catch(() => null)
  }

  await db.user.update({ where: { id: actorId }, data: { image: null } })

  await createAuditLog({
    actorId,
    action: "UPDATE",
    entityType: "user",
    entityId: actorId,
    changes: { before: { image: current?.image ?? null }, after: { image: null } },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ success: true })
}
