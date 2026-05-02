import { db } from "./db"
import type { AuditAction } from "@prisma/client"
import type { InputJsonValue } from "@prisma/client/runtime/library"

export async function createAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  changes,
  ipAddress,
}: {
  actorId: string
  action: AuditAction
  entityType: string
  entityId: string
  changes?: Record<string, unknown>
  ipAddress?: string
}) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      changes: changes as InputJsonValue | undefined,
      ipAddress,
    },
  })
}
