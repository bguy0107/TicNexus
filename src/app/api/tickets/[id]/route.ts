import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/session"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { getTicketLocationIds } from "@/lib/scope"
import { getIpFromRequest } from "@/lib/utils"
import { z } from "zod"
import type { Role, TicketStatus } from "@prisma/client"

async function resolveTicket(id: string, userId: string, role: Role) {
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true, locationNumber: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      history: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!ticket) return null

  if (role !== "ADMIN") {
    const locationIds = await getTicketLocationIds(userId, role)
    if (locationIds && !locationIds.includes(ticket.locationId)) return null
  }

  return ticket
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  if (!hasPermission(role, "ticket:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const ticket = await resolveTicket(id, session.user.id, role)
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ ticket })
}

const patchSchema = z
  .object({
    status: z
      .enum([
        "OPEN",
        "IN_PROGRESS",
        "ORDERED",
        "MONITORING",
        "AWAITING_APPROVAL",
        "APPROVED",
        "PROJECTED",
        "CLOSED",
      ])
      .optional(),
    comment: z.string().optional(),
    cost: z.number().positive().optional(),
    deadline: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.status && !data.deadline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status or deadline is required",
      })
    }
    if (data.status === "AWAITING_APPROVAL" && data.cost === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cost is required when setting status to Awaiting Approval",
        path: ["cost"],
      })
    }
    if (data.status === "PROJECTED" && !data.deadline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Deadline is required when projecting a ticket",
        path: ["deadline"],
      })
    }
  })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(request.headers)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = session.user.role as Role
  const { id } = await params

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      locationId: true,
      status: true,
      createdById: true,
      type: true,
      deadline: true,
    },
  })
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Scope check
  if (role !== "ADMIN") {
    const locationIds = await getTicketLocationIds(session.user.id, role)
    if (locationIds && !locationIds.includes(ticket.locationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { status: newStatus, comment, cost, deadline } = parsed.data
  const isCreator = ticket.createdById === session.user.id
  const canUpdateStatus = hasPermission(role, "ticket:update_status")

  // ── Deadline-only update (no status change) ───────────────────────────────
  if (!newStatus && deadline) {
    if (ticket.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot update deadline on a closed ticket" },
        { status: 400 }
      )
    }
    const isCreatorForDeadline = ticket.createdById === session.user.id
    if (!hasPermission(role, "ticket:update_deadline") && !isCreatorForDeadline) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const newDeadline = new Date(deadline)
    const updated = await db.ticket.update({
      where: { id },
      data: { deadline: newDeadline },
      include: {
        location: { select: { id: true, name: true, locationNumber: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    await db.ticketHistory.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        comment: `Deadline updated to ${newDeadline.toLocaleDateString()}`,
        statusFrom: null,
        statusTo: null,
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: "UPDATE",
      entityType: "ticket",
      entityId: id,
      changes: { deadline: deadline },
      ipAddress: getIpFromRequest(request),
    })

    return NextResponse.json({ ticket: updated })
  }

  // ── Status change ─────────────────────────────────────────────────────────

  // PROJECTED tickets have stricter access control.
  // Creator-close exception does not apply while a ticket is projected.
  if (ticket.status === "PROJECTED") {
    if (hasPermission(role, "ticket:override_projected")) {
      // ADMIN, FM, SUPERVISOR — always allowed
    } else if (hasPermission(role, "ticket:update_status")) {
      // TECHNICIAN — must wait for the projected deadline
      if (!ticket.deadline) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const deadlineDay = new Date(ticket.deadline)
      deadlineDay.setHours(0, 0, 0, 0)
      if (today < deadlineDay) {
        return NextResponse.json(
          { error: "You cannot change this ticket's status until the projected deadline" },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else {
    // Closing: the original creator can close their own ticket regardless of role;
    // otherwise ticket:update_status is required.
    if (newStatus === "CLOSED") {
      if (!isCreator && !canUpdateStatus) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (!canUpdateStatus) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Roles without franchise:set_cost_limit (i.e. SUPERVISOR) are gated by the franchise cost limit
  if (newStatus === "APPROVED" && !hasPermission(role, "franchise:set_cost_limit")) {
    const location = await db.location.findUnique({
      where: { id: ticket.locationId },
      select: { franchise: { select: { maintenanceCostLimit: true, itCostLimit: true } } },
    })
    const franchise = location?.franchise
    const rawLimit =
      ticket.type === "MAINTENANCE" ? franchise?.maintenanceCostLimit : franchise?.itCostLimit
    const costLimit = rawLimit ? Number(rawLimit) : null

    if (costLimit !== null) {
      const awaitingEntry = await db.ticketHistory.findFirst({
        where: { ticketId: id, statusTo: "AWAITING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        select: { cost: true },
      })
      const ticketCost = awaitingEntry?.cost ? Number(awaitingEntry.cost) : null
      const typeLabel = ticket.type === "MAINTENANCE" ? "Maintenance" : "IT"
      if (ticketCost !== null && ticketCost > costLimit) {
        return NextResponse.json(
          {
            error: `Cost ($${ticketCost.toFixed(2)}) exceeds the ${typeLabel} approval limit ($${costLimit.toFixed(2)})`,
          },
          { status: 403 }
        )
      }
    }
  }

  const prevStatus = ticket.status as TicketStatus

  const updated = await db.ticket.update({
    where: { id },
    data: {
      status: newStatus!,
      ...(newStatus === "PROJECTED" && deadline ? { deadline: new Date(deadline) } : {}),
    },
    include: {
      location: { select: { id: true, name: true, locationNumber: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  await db.ticketHistory.create({
    data: {
      ticketId: id,
      userId: session.user.id,
      comment: comment ?? null,
      statusFrom: prevStatus,
      statusTo: newStatus!,
      cost: cost ?? null,
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "ticket",
    entityId: id,
    changes: { statusFrom: prevStatus, statusTo: newStatus },
    ipAddress: getIpFromRequest(request),
  })

  return NextResponse.json({ ticket: updated })
}
