import { requireAuth } from "@/lib/session"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth()

  if (session.user.mustChangePassword) {
    redirect("/change-password")
  }

  const { firstName, lastName, email, role } = session.user as {
    firstName: string
    lastName: string
    email: string
    role: Role
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userRole={role} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Header firstName={firstName} lastName={lastName} email={email} role={role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
