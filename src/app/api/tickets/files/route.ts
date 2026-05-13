import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { hasPermission } from "@/lib/permissions"
import { getTicketLocationIds } from "@/lib/scope"
import path from "path"
import { createReadStream, statSync } from "fs"
import { Readable } from "stream"
import type { Role } from "@prisma/client"

// GET /api/tickets/files?path=<relativePath>
// Serves an uploaded ticket attachment after verifying the requester has access to the ticket.
export async function GET(request: NextRequest) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "ticket:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const filePath = request.nextUrl.searchParams.get("path")
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 })

  // Prevent path traversal
  const uploadsRoot = path.resolve(process.cwd(), "uploads", "tickets")
  const resolved = path.resolve(uploadsRoot, filePath)
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  // Extract ticketId from path (uploads/tickets/<ticketId>/<filename>)
  const parts = filePath.split("/")
  const ticketId = parts[0]

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { locationId: true },
  })
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "ADMIN") {
    const locationIds = await getTicketLocationIds(session.user.id, role)
    if (locationIds && !locationIds.includes(ticket.locationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const fileStat = statSync(resolved)
    const fileSize = fileStat.size
    const ext = path.extname(resolved).toLowerCase()
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".pdf": "application/pdf",
    }
    const contentType = contentTypes[ext] ?? "application/octet-stream"

    const rangeHeader = request.headers.get("range")
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1
      const chunkSize = end - start + 1
      const nodeStream = createReadStream(resolved, { start, end })
      const webStream = Readable.toWeb(nodeStream) as ReadableStream
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
        },
      })
    }

    const nodeStream = createReadStream(resolved)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
