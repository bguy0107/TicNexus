import { db } from "./db"

export async function getFranchiseMgrFranchiseIds(userId: string): Promise<string[]> {
  const rows = await db.userFranchise.findMany({ where: { userId }, select: { franchiseId: true } })
  return rows.map((r) => r.franchiseId)
}

export async function getFranchiseMgrLocationIds(userId: string): Promise<string[]> {
  const franchiseIds = await getFranchiseMgrFranchiseIds(userId)
  if (franchiseIds.length === 0) return []
  const rows = await db.location.findMany({
    where: { franchiseId: { in: franchiseIds } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function getSupervisorLocationIds(userId: string): Promise<string[]> {
  const rows = await db.userLocation.findMany({ where: { userId }, select: { locationId: true } })
  return rows.map((r) => r.locationId)
}

export async function isTargetInFranchiseMgrScope(
  actorId: string,
  targetUserId: string
): Promise<boolean> {
  const [franchiseIds, locationIds] = await Promise.all([
    getFranchiseMgrFranchiseIds(actorId),
    getFranchiseMgrLocationIds(actorId),
  ])
  if (franchiseIds.length === 0) return false

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      userFranchises: { select: { franchiseId: true } },
      userLocations: { select: { locationId: true } },
    },
  })
  if (!target) return false

  return (
    target.userFranchises.some((uf) => franchiseIds.includes(uf.franchiseId)) ||
    target.userLocations.some((ul) => locationIds.includes(ul.locationId))
  )
}

// Works for SUPERVISOR, TECHNICIAN, and STORE_USER — any role with userLocation assignments
export async function isTargetInLocationScope(
  actorId: string,
  targetUserId: string
): Promise<boolean> {
  const locationIds = await getSupervisorLocationIds(actorId)
  if (locationIds.length === 0) return false

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { userLocations: { select: { locationId: true } } },
  })
  if (!target) return false

  return target.userLocations.some((ul) => locationIds.includes(ul.locationId))
}
