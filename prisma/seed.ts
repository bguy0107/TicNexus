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

async function seed() {
  console.log("Seeding database...")

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
      data: {
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        emailVerified: true,
      },
    })

    console.log(`  created ${u.role.padEnd(17)} ${u.email}  /  ${u.password}`)
  }

  console.log("Done.")
}

seed()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
