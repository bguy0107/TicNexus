import { PrismaClient } from "@prisma/client"
import { hashPassword } from "@better-auth/utils/password"

const db = new PrismaClient()

async function initAdmin() {
  const email = "admin@ticnexus.com"
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin user already exists — skipping.`)
    return
  }

  const id = crypto.randomUUID()
  const now = new Date()
  const hashed = await hashPassword("Admin1234!")

  await db.user.create({
    data: {
      id,
      name: "Admin User",
      email,
      emailVerified: true,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  })

  await db.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: email,
      providerId: "credential",
      userId: id,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log(`Admin user created: ${email}`)
}

initAdmin()
  .catch((e) => {
    console.error("Failed to initialise admin user:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())