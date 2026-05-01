"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users,
  Building2,
  MapPin,
  LayoutDashboard,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"] },
  { href: "/dashboard/users", label: "Users", icon: Users, roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR"] },
  { href: "/dashboard/franchises", label: "Franchises", icon: Building2, roles: ["ADMIN", "TECHNICIAN"] },
  { href: "/dashboard/locations", label: "Locations", icon: MapPin, roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN"] },
] as const

interface SidebarProps {
  userRole: Role
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(userRole)
  )

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
      <div className="flex flex-col flex-grow bg-slate-900 overflow-y-auto">
        <div className="flex items-center h-16 flex-shrink-0 px-6">
          <span className="text-white font-bold text-xl tracking-tight">TicNexus</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
