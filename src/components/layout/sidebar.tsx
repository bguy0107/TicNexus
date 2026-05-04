"use client"

import type { Role } from "@prisma/client"
import { NavLinks } from "./nav-links"

interface SidebarProps {
  userRole: Role
}

export function Sidebar({ userRole }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
      <div className="flex flex-col flex-grow bg-[#0a0a0a] overflow-y-auto border-r border-border">
        <div className="flex items-center h-16 flex-shrink-0 px-6">
          <span className="text-foreground font-bold text-xl tracking-tight">TicNexus</span>
        </div>
        <NavLinks userRole={userRole} />
      </div>
    </aside>
  )
}
