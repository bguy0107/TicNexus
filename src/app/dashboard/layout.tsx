import { requireAuth } from "@/lib/session"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import type { Role, Department } from "@prisma/client"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth()

  // Read mustChangePassword from the DB directly so a stale Better-Auth
  // session cookie cache can never block access after the password was changed.
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  })
  if (dbUser?.mustChangePassword) {
    redirect("/change-password")
  }

  const { firstName, lastName, email, role, image, departments } = session.user as {
    firstName: string
    lastName: string
    email: string
    role: Role
    image?: string | null
    departments: Department[]
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userRole={role} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Header
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
          image={image ?? null}
          departments={departments}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
