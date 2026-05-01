import type { Role } from "@prisma/client"

export type { Role }

export interface UserWithRelations {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  role: Role
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
  franchiseId?: string
  locationId?: string
}

export interface ApiError {
  error: string
}
