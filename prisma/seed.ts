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
    departments: [] as const,
  },
  {
    firstName: "Franchise",
    lastName: "Manager",
    email: "franchise@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
    departments: [] as const,
  },
  {
    firstName: "Franchise",
    lastName: "Manager Two",
    email: "franchise2@ticnexus.com",
    password: "Manager1234!",
    role: "FRANCHISE_MANAGER" as const,
    departments: [] as const,
  },
  {
    firstName: "Store",
    lastName: "User",
    email: "store@ticnexus.com",
    password: "StoreUser1234!",
    role: "STORE_USER" as const,
    departments: [] as const,
  },
  {
    firstName: "Supervisor",
    lastName: "One",
    email: "supervisor1@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
    departments: [] as const,
  },
  {
    firstName: "Supervisor",
    lastName: "Two",
    email: "supervisor2@ticnexus.com",
    password: "Supervisor1234!",
    role: "SUPERVISOR" as const,
    departments: [] as const,
  },
  {
    firstName: "Technician",
    lastName: "One",
    email: "tech1@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
    departments: ["IT"] as const,
  },
  {
    firstName: "Technician",
    lastName: "Two",
    email: "tech2@ticnexus.com",
    password: "Technician1234!",
    role: "TECHNICIAN" as const,
    departments: ["MAINTENANCE"] as const,
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
      const existingDepts = existing.departments
      const seedDepts = [...u.departments]
      const deptsChanged =
        existingDepts.length !== seedDepts.length ||
        seedDepts.some((d) => !existingDepts.includes(d))
      if (deptsChanged) {
        await db.user.update({
          where: { id: existing.id },
          data: { departments: { set: seedDepts } },
        })
        console.log(`  updated departments  ${u.email} → ${seedDepts.join(", ") || "none"}`)
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
        departments: { set: [...u.departments] },
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

  // ── Tickets ──────────────────────────────────────────────────────────────────
  console.log("\nSeeding tickets...")

  const existingTicketCount = await db.ticket.count()
  if (existingTicketCount > 0) {
    console.log(`  skip  tickets (${existingTicketCount} already exist)`)
  } else {
    const userByEmail = async (email: string) => {
      const u = await db.user.findUnique({ where: { email } })
      if (!u) throw new Error(`User not found: ${email}`)
      return u
    }
    const locationByName = async (name: string) => {
      const l = await db.location.findFirst({ where: { name, deletedAt: null } })
      if (!l) throw new Error(`Location not found: ${name}`)
      return l
    }

    const storeUser = await userByEmail("store@ticnexus.com")
    const sup1 = await userByEmail("supervisor1@ticnexus.com")
    const sup2 = await userByEmail("supervisor2@ticnexus.com")
    const tech1 = await userByEmail("tech1@ticnexus.com")
    const tech2 = await userByEmail("tech2@ticnexus.com")
    const fm1 = await userByEmail("franchise@ticnexus.com")

    const loc1A = await locationByName("Location 1A")
    const loc1B = await locationByName("Location 1B")
    const loc2A = await locationByName("Location 2A")
    const loc2B = await locationByName("Location 2B")

    const ticketDefs = [
      // IT — OPEN, just filed
      {
        type: "IT" as const,
        status: "OPEN" as const,
        issue: "POS terminal at register 2 freezes after 30 minutes of inactivity",
        locationId: loc1A.id,
        createdById: storeUser.id,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        history: [{ userId: storeUser.id, statusFrom: null, statusTo: "OPEN" as const }],
      },
      // IT — IN_PROGRESS, tech picked it up
      {
        type: "IT" as const,
        status: "IN_PROGRESS" as const,
        issue: "Network switch in back office dropping packets intermittently",
        locationId: loc1B.id,
        createdById: sup1.id,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        history: [
          { userId: sup1.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech1.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment:
              "Identified faulty cable between switch port 4 and wall jack. Replacement ordered.",
          },
        ],
      },
      // IT — AWAITING_APPROVAL
      {
        type: "IT" as const,
        status: "AWAITING_APPROVAL" as const,
        issue: "Security camera DVR hard drive failure — footage unavailable for 48 hours",
        locationId: loc2A.id,
        createdById: sup2.id,
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        history: [
          { userId: sup2.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech1.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment: "DVR unit confirmed failed. Recommending full replacement ($420).",
          },
          {
            userId: sup2.id,
            statusFrom: "IN_PROGRESS" as const,
            statusTo: "AWAITING_APPROVAL" as const,
            comment: "Repair quote submitted. Awaiting FM sign-off before purchasing.",
          },
        ],
      },
      // IT — CLOSED
      {
        type: "IT" as const,
        status: "CLOSED" as const,
        issue: "Staff unable to log into the scheduling app — password reset not sending email",
        locationId: loc2B.id,
        createdById: tech2.id,
        deadline: null,
        history: [
          { userId: tech2.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech2.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment:
              "Confirmed SMTP relay config was pointing to wrong port. Fixed in admin panel.",
          },
          {
            userId: tech2.id,
            statusFrom: "IN_PROGRESS" as const,
            statusTo: "CLOSED" as const,
            comment: "Reset emails working. All affected staff confirmed access restored.",
          },
        ],
      },
      // MAINTENANCE — OPEN, just filed
      {
        type: "MAINTENANCE" as const,
        status: "OPEN" as const,
        issue: "Men's restroom — hand dryer not working, loose mounting bracket",
        locationId: loc1B.id,
        createdById: storeUser.id,
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        history: [{ userId: storeUser.id, statusFrom: null, statusTo: "OPEN" as const }],
      },
      // MAINTENANCE — IN_PROGRESS
      {
        type: "MAINTENANCE" as const,
        status: "IN_PROGRESS" as const,
        issue: "HVAC unit on roof making loud grinding noise — cooling capacity reduced",
        locationId: loc1A.id,
        createdById: sup1.id,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        history: [
          { userId: sup1.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech2.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment:
              "Bearing in blower motor is failing. Part sourced, install scheduled for tomorrow.",
          },
        ],
      },
      // MAINTENANCE — AWAITING_APPROVAL
      {
        type: "MAINTENANCE" as const,
        status: "AWAITING_APPROVAL" as const,
        issue: "Parking lot lights out on west side — 6 of 8 fixtures not working",
        locationId: loc2A.id,
        createdById: sup2.id,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        history: [
          { userId: sup2.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech2.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment: "Ballasts in fixtures failed. Estimating $850 for parts and labour.",
          },
          {
            userId: sup2.id,
            statusFrom: "IN_PROGRESS" as const,
            statusTo: "AWAITING_APPROVAL" as const,
            comment: "Quote attached. Needs FM approval to proceed.",
          },
        ],
      },
      // MAINTENANCE — CLOSED
      {
        type: "MAINTENANCE" as const,
        status: "CLOSED" as const,
        issue: "Back door handle broken — door not latching securely",
        locationId: loc2B.id,
        createdById: fm1.id,
        deadline: null,
        history: [
          { userId: fm1.id, statusFrom: null, statusTo: "OPEN" as const },
          {
            userId: tech2.id,
            statusFrom: "OPEN" as const,
            statusTo: "IN_PROGRESS" as const,
            comment: "Deadbolt latch mechanism replaced. Aligned strike plate.",
          },
          {
            userId: fm1.id,
            statusFrom: "IN_PROGRESS" as const,
            statusTo: "CLOSED" as const,
            comment: "Verified door latches and locks correctly. Resolved.",
          },
        ],
      },
    ]

    for (const def of ticketDefs) {
      const { history, ...ticketData } = def
      const ticket = await db.ticket.create({ data: ticketData })
      for (const h of history) {
        await db.ticketHistory.create({ data: { ...h, ticketId: ticket.id } })
      }
      console.log(
        `  created ${def.type.padEnd(11)} [${def.status.padEnd(17)}] ${def.issue.slice(0, 55)}...`
      )
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
