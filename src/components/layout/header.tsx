"use client"

import { LogOut, User } from "lucide-react"
import { signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/utils"
import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@prisma/client"

interface HeaderProps {
  firstName: string
  lastName: string
  email: string
  role: Role
}

export function Header({ firstName, lastName, email, role }: HeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })
  }

  return (
    <header className="bg-background border-b h-16 flex items-center justify-between px-6 md:pl-6">
      <div className="flex items-center gap-2 md:hidden">
        <span className="font-bold text-lg text-foreground">TicNexus</span>
      </div>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                {getInitials(firstName, lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none">
                {firstName} {lastName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{getRoleLabel(role)}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{firstName} {lastName}</p>
            <p className="text-xs text-muted-foreground font-normal">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
