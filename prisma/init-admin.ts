import { auth } from "../src/lib/auth"
import { db } from "../src/lib/db"

async function initAdmin() {
  const email = "admin@ticnexus.com"

  const existing = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  })

  if (existing?.accounts.length) {
    console.log("Admin user already exists — skipping.")
    return
  }

  // User row exists but credential account is missing or was created with the
  // wrong hash. Remove the bare user record so signUpEmail can recreate it
  // properly through Better-Auth's internal hashing path.
  if (existing) {
    await db.account.deleteMany({ where: { userId: existing.id } })
    await db.user.delete({ where: { id: existing.id } })
  }

  const response = await auth.api.signUpEmail({
    body: {
      email,
      password: "Admin1234!",
      name: "Admin User",
      firstName: "Admin",
      lastName: "User",
    },
  })

  if (!response?.user) throw new Error("signUpEmail returned no user")

  await db.user.update({
    where: { id: response.user.id },
    data: { role: "ADMIN", emailVerified: true, firstName: "Admin", lastName: "User", mustChangePassword: true },
  })

  console.log(`Admin user created: ${email}`)
}

initAdmin()
  .catch((e) => {
    console.error("Failed to initialise admin user:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
