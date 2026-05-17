"use client"

import { useState } from "react"
import { LogOut, Menu, UserCircle } from "lucide-react"
import { signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getInitials } from "@/lib/utils"
import { getRoleLabel } from "@/lib/permissions"
import { NavLinks } from "./nav-links"
import { ProfileDialog } from "@/components/users/profile-dialog"
import type { Role, Department } from "@prisma/client"

interface HeaderProps {
  firstName: string
  lastName: string
  email: string
  role: Role
  image: string | null
  departments: Department[]
}

export function Header({ firstName, lastName, email, role, image, departments }: HeaderProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })
  }

  return (
    <header className="bg-background border-b h-16 flex items-center justify-between px-6 md:pl-6">
      <div className="flex items-center gap-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-background border-r border-border">
            <SheetHeader className="h-16 flex justify-center px-6 border-b border-border">
              <SheetTitle className="text-foreground font-bold text-xl tracking-tight text-left">
                TicNexus
              </SheetTitle>
            </SheetHeader>
            <NavLinks userRole={role} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-lg text-foreground">TicNexus</span>
      </div>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors">
            <Avatar className="h-8 w-8">
              {image && <AvatarImage src={image} alt={`${firstName} ${lastName}`} />}
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
            <p className="font-medium">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-muted-foreground font-normal">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setProfileOpen(true)}>
            <UserCircle className="h-4 w-4" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 cursor-pointer text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} departments={departments} />
    </header>
  )
}
