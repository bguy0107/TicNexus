import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (session) redirect("/dashboard")
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">TicNexus</h1>
          <p className="text-muted-foreground mt-1 text-sm">Franchise Equipment & IT Management</p>
        </div>
        {children}
      </div>
    </div>
  )
}
