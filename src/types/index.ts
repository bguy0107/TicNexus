import type {
  Role,
  Department,
  TicketStatus,
  FootageRequestStatus,
  RequestingParty,
} from "@prisma/client"

export type { Role, Department, TicketStatus, FootageRequestStatus, RequestingParty }

export interface UserWithRelations {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  role: Role
  departments: Department[]
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

export interface FootageRequestUser {
  id: string
  firstName: string
  lastName: string
}

export interface FootageRequestLocation {
  id: string
  name: string
  locationNumber: string
}

export interface FootageRequestWithDetails {
  id: string
  locationId: string
  location: FootageRequestLocation
  startDateTime: string | Date
  endDateTime: string | Date
  cameraArea: string
  requestingParty: RequestingParty
  officerName: string | null
  status: FootageRequestStatus
  resolutionNote: string | null
  resolvedById: string | null
  resolvedBy: FootageRequestUser | null
  resolvedAt: string | Date | null
  createdById: string
  createdBy: FootageRequestUser
  createdAt: string | Date
  updatedAt: string | Date
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
