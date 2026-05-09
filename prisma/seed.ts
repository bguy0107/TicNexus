import { PrismaClient } from "@prisma/client"
import { hashPassword } from "@better-auth/utils/password"

const db = new PrismaClient()

const users = [
  {
    firstName: "Admin",
    lastName: "User",
    email: "admin@ticnexus.com",
    password: "Admin1234!",
    role: "ADMIN" as const,
    department: null,
  },
  {
    firstName: "Franchise",
    lastName: "Manager",
    email: "franchise@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
    department: null,
  },
  {
    firstName: "Franchise",
    lastName: "Manager Two",
    email: "franchise2@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
    department: null,
  },
  {
    firstName: "Store",
    lastName: "User",
    email: "store@ticnexus.com",
    password: "StoreUser1234!",
    role: "STORE_USER" as const,
    department: null,
  },
  {
    firstName: "Supervisor",
    lastName: "One",
    email: "supervisor1@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
    department: null,
  },
  {
    firstName: "Supervisor",
    lastName: "Two",
    email: "supervisor2@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
    department: null,
  },
  {
    firstName: "Technician",
    lastName: "One",
    email: "tech1@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
    department: "IT" as const,
  },
  {
    firstName: "Technician",
    lastName: "Two",
    email: "tech2@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
    department: "MAINTENANCE" as const,
  },
]

const franchiseData = [
  {
    name: "Franchise One",
    managerEmail: "franchise@ticnexus.com",
    locations: [
      { locationNumber: "1A", name: "Location 1A" },
      { locationNumber: "1B", name: "Location 1B" },
    ],
  },
  {
    name: "Franchise Two",
    managerEmail: "franchise2@ticnexus.com",
    locations: [
      { locationNumber: "2A", name: "Location 2A" },
      { locationNumber: "2B", name: "Location 2B" },
    ],
  },
]

// Location assignments for non-FM roles.
// supervisor1 covers all of Franchise One; supervisor2 covers Location 2A.
// tech1 (IT) covers Franchise One; tech2 (Maintenance) covers Franchise Two.
// store user is at Location 1B.
const locationAssignments: { email: string; locationName: string }[] = [
  { email: "supervisor1@ticnexus.com", locationName: "Location 1A" },
  { email: "supervisor1@ticnexus.com", locationName: "Location 1B" },
  { email: "supervisor2@ticnexus.com", locationName: "Location 2A" },
  { email: "tech1@ticnexus.com", locationName: "Location 1A" },
  { email: "tech1@ticnexus.com", locationName: "Location 1B" },
  { email: "tech2@ticnexus.com", locationName: "Location 2A" },
  { email: "tech2@ticnexus.com", locationName: "Location 2B" },
  { email: "store@ticnexus.com", locationName: "Location 1B" },
]

async function seed() {
  console.log("Seeding database...")

  // ── Users ────────────────────────────────────────────────────────────────────
  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } })
    if (existing) {
      // Update department if it changed (e.g. technicians added after initial seed)
      if (u.department !== undefined && existing.department !== u.department) {
        await db.user.update({ where: { id: existing.id }, data: { department: u.department } })
        console.log(`  updated department   ${u.email} → ${u.department}`)
      } else {
        console.log(`  skip  ${u.email} (already exists)`)
      }
      continue
    }

    const id = crypto.randomUUID()
    const hashed = await hashPassword(u.password)
    const now = new Date()

    await db.user.create({
      data: {
        id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        emailVerified: true,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        department: u.department,
        createdAt: now,
        updatedAt: now,
      },
    })

    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: u.email,
        providerId: "credential",
        userId: id,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      },
    })

    console.log(`  created ${u.role.padEnd(17)} ${u.email}  /  ${u.password}`)
  }

  // ── Franchises, Locations, and FM assignments ─────────────────────────────
  console.log("\nSeeding franchises and locations...")

  for (const fd of franchiseData) {
    let franchise = await db.franchise.findFirst({ where: { name: fd.name, deletedAt: null } })
    if (!franchise) {
      franchise = await db.franchise.create({ data: { name: fd.name } })
      console.log(`  created franchise    ${fd.name}`)
    } else {
      console.log(`  skip  franchise      ${fd.name} (already exists)`)
    }

    for (const loc of fd.locations) {
      const existing = await db.location.findFirst({
        where: { name: loc.name, franchiseId: franchise.id, deletedAt: null },
      })
      if (!existing) {
        await db.location.create({
          data: { name: loc.name, locationNumber: loc.locationNumber, franchiseId: franchise.id },
        })
        console.log(`    created location   ${loc.name}`)
      } else {
        console.log(`    skip  location     ${loc.name} (already exists)`)
      }
    }

    const manager = await db.user.findUnique({ where: { email: fd.managerEmail } })
    if (manager) {
      const alreadyAssigned = await db.userFranchise.findUnique({
        where: { userId_franchiseId: { userId: manager.id, franchiseId: franchise.id } },
      })
      if (!alreadyAssigned) {
        await db.userFranchise.create({ data: { userId: manager.id, franchiseId: franchise.id } })
        console.log(`  assigned FM          ${fd.managerEmail} → ${fd.name}`)
      } else {
        console.log(`  skip  FM assignment  ${fd.managerEmail} → ${fd.name} (already assigned)`)
      }
    }
  }

  // ── Location assignments (supervisors, technicians, store users) ──────────
  console.log("\nSeeding location assignments...")

  for (const la of locationAssignments) {
    const user = await db.user.findUnique({ where: { email: la.email } })
    const location = await db.location.findFirst({
      where: { name: la.locationName, deletedAt: null },
    })

    if (!user || !location) {
      console.log(
        `  skip  assignment     ${la.email} → ${la.locationName} (user or location not found)`
      )
      continue
    }

    const alreadyAssigned = await db.userLocation.findUnique({
      where: { userId_locationId: { userId: user.id, locationId: location.id } },
    })

    if (!alreadyAssigned) {
      await db.userLocation.create({ data: { userId: user.id, locationId: location.id } })
      console.log(`  assigned             ${la.email} → ${la.locationName}`)
    } else {
      console.log(`  skip  assignment     ${la.email} → ${la.locationName} (already assigned)`)
    }
  }

  console.log("\nDone.")
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
