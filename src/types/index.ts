import type { Role, Department } from "@prisma/client"

export type { Role, Department }

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
