"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Building2, MapPin, LayoutDashboard, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"

export const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"],
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: Users,
    roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR"],
  },
  {
    href: "/dashboard/franchises",
    label: "Franchises",
    icon: Building2,
    roles: ["ADMIN", "TECHNICIAN"],
  },
  {
    href: "/dashboard/locations",
    label: "Locations",
    icon: MapPin,
    roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN"],
  },
  {
    href: "/dashboard/tickets",
    label: "Tickets",
    icon: Ticket,
    roles: ["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"],
  },
] as const

interface NavLinksProps {
  userRole: Role
  onNavigate?: () => void
}

export function NavLinks({ userRole, onNavigate }: NavLinksProps) {
  const pathname = usePathname()

  const visibleItems = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(userRole)
  )

  return (
    <nav className="flex-1 px-4 py-4 space-y-1">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
