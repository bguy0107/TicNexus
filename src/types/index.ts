import type { Role, Department, TicketStatus } from "@prisma/client"

export type { Role, Department, TicketStatus }

export interface UserWithRelations {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  role: Role
  department: Department | null
  createdAt: Date | string
  deletedAt: Date | string | null
  userFranchises: Array<{
    franchise: { id: string; name: string }
  }>
  userLocations: Array<{
    location: { id: string; name: string; franchise: { name: string } }
  }>
}

export interface FranchiseWithDetails {
  id: string
  name: string
  maintenanceCostLimit: string | number | null
  itCostLimit: string | number | null
  createdAt: Date | string
  deletedAt: Date | string | null
  _count: {
    locations: number
    userFranchises: number
  }
}

export interface LocationWithDetails {
  id: string
  name: string
  locationNumber: string
  address: string | null
  franchiseId: string
  franchise: { name: string }
  createdAt: Date | string
  deletedAt: Date | string | null
  _count: {
    userLocations: number
  }
}

export interface InvitationPayload {
  email: string
  role: Role
  department?: Department
  franchiseId?: string
  locationId?: string
}

export interface ApiError {
  error: string
}

export interface TicketUser {
  id: string
  firstName: string
  lastName: string
  role: string
}

export interface TicketLocation {
  id: string
  name: string
  locationNumber: string
}

export interface TicketHistoryEntry {
  id: string
  ticketId: string
  userId: string
  user: TicketUser
  comment: string | null
  attachment: string | null
  statusFrom: TicketStatus | null
  statusTo: TicketStatus | null
  cost: string | null
  createdAt: string | Date
}

export interface TicketWithDetails {
  id: string
  type: Department
  status: TicketStatus
  issue: string
  locationId: string
  location: TicketLocation
  deadline: string | Date | null
  createdById: string
  createdBy: TicketUser
  createdAt: string | Date
  updatedAt: string | Date
  history?: TicketHistoryEntry[]
}
