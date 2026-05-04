import { requireAuth } from "@/lib/session"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2, MapPin } from "lucide-react"
import { QuickActions } from "@/components/dashboard/quick-actions"
import type { Role } from "@prisma/client"

export default async function DashboardPage() {
  const session = await requireAuth()
  const role = session.user.role as Role
  const userId = session.user.id

  let userCount = 0
  let franchiseCount = 0
  let locationCount = 0

  if (role === "ADMIN") {
    ;[userCount, franchiseCount, locationCount] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.franchise.count({ where: { deletedAt: null } }),
      db.location.count({ where: { deletedAt: null } }),
    ])
  } else if (role === "FRANCHISE_MANAGER") {
    const uf = await db.userFranchise.findFirst({ where: { userId } })
    if (uf) {
      ;[locationCount, userCount] = await Promise.all([
        db.location.count({ where: { franchiseId: uf.franchiseId, deletedAt: null } }),
        db.userLocation.count({
          where: { location: { franchiseId: uf.franchiseId, deletedAt: null } },
        }),
      ])
      franchiseCount = 1
    }
  } else if (role === "SUPERVISOR" || role === "TECHNICIAN") {
    const uls = await db.userLocation.findMany({ where: { userId } })
    locationCount = uls.length
  }

  const stats = [
    { label: "Total Users", value: userCount, icon: Users, show: role !== "STORE_USER" },
    {
      label: "Franchises",
      value: franchiseCount,
      icon: Building2,
      show: role === "ADMIN" || role === "TECHNICIAN",
    },
    { label: "Locations", value: locationCount, icon: MapPin, show: role !== "STORE_USER" },
  ].filter((s) => s.show)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {role === "ADMIN" && <QuickActions />}
    </div>
  )
}
