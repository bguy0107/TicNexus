import { PrismaClient } from "@prisma/client"
import { auth } from "../src/lib/auth"

const db = new PrismaClient()

const users = [
  {
    firstName: "Admin",
    lastName: "User",
    email: "admin@ticnexus.com",
    password: "Admin1234!",
    role: "ADMIN" as const,
  },
  {
    firstName: "Franchise",
    lastName: "Manager",
    email: "franchise@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
  },
  {
    firstName: "Franchise",
    lastName: "Manager Two",
    email: "franchise2@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
  },
  {
    firstName: "Store",
    lastName: "User",
    email: "store@ticnexus.com",
    password: "StoreUser1234!",
    role: "STORE_USER" as const,
  },
  {
    firstName: "Supervisor",
    lastName: "One",
    email: "supervisor1@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
  },
  {
    firstName: "Supervisor",
    lastName: "Two",
    email: "supervisor2@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
  },
  {
    firstName: "Technician",
    lastName: "One",
    email: "tech1@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
  },
  {
    firstName: "Technician",
    lastName: "Two",
    email: "tech2@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
  },
]

const franchiseData = [
  {
    name: "Franchise One",
    managerEmail: "franchise@ticnexus.com",
    locations: ["Location 1A", "Location 1B"],
  },
  {
    name: "Franchise Two",
    managerEmail: "franchise2@ticnexus.com",
    locations: ["Location 2A", "Location 2B"],
  },
]

async function seed() {
  console.log("Seeding database...")

  // ── Users ────────────────────────────────────────────────────────────────────
  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } })
    if (existing) {
      console.log(`  skip  ${u.email} (already exists)`)
      continue
    }

    const result = await auth.api.signUpEmail({
      body: {
        email: u.email,
        password: u.password,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
      } as NonNullable<Parameters<typeof auth.api.signUpEmail>[0]>["body"],
    })

    if (!result?.user) {
      console.error(`  error creating ${u.email}`)
      continue
    }

    await db.user.update({
      where: { id: result.user.id },
      data: { firstName: u.firstName, lastName: u.lastName, role: u.role, emailVerified: true },
    })

    console.log(`  created ${u.role.padEnd(17)} ${u.email}  /  ${u.password}`)
  }

  // ── Franchises, Locations, and FM assignments ─────────────────────────────
  console.log("\nSeeding franchises and locations...")

  for (const fd of franchiseData) {
    // Find or create franchise
    let franchise = await db.franchise.findFirst({ where: { name: fd.name, deletedAt: null } })
    if (!franchise) {
      franchise = await db.franchise.create({ data: { name: fd.name } })
      console.log(`  created franchise    ${fd.name}`)
    } else {
      console.log(`  skip  franchise      ${fd.name} (already exists)`)
    }

    // Find or create locations
    for (const locationName of fd.locations) {
      const existing = await db.location.findFirst({
        where: { name: locationName, franchiseId: franchise.id, deletedAt: null },
      })
      if (!existing) {
        await db.location.create({ data: { name: locationName, franchiseId: franchise.id } })
        console.log(`    created location   ${locationName}`)
      } else {
        console.log(`    skip  location     ${locationName} (already exists)`)
      }
    }

    // Assign franchise manager
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

  console.log("\nDone.")
}

seed()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
