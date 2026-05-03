"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { UserPlus } from "lucide-react"
import type { Role } from "@prisma/client"

const INVITABLE_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "FRANCHISE_MANAGER", label: "Franchise Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "STORE_USER", label: "Store User" },
]

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["ADMIN", "FRANCHISE_MANAGER", "SUPERVISOR", "TECHNICIAN", "STORE_USER"]),
  franchiseId: z.string().optional(),
  locationId: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Franchise {
  id: string
  name: string
}
interface Location {
  id: string
  name: string
  franchiseId: string
  franchise: { name: string }
}

interface InviteUserDialogProps {
  actorRole: Role
  onSuccess?: () => void
}

export function InviteUserDialog({ actorRole, onSuccess }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedRole = watch("role")
  const selectedFranchiseId = watch("franchiseId")

  useEffect(() => {
    if (!open) return
    fetch("/api/franchises")
      .then((r) => r.json())
      .then((d) => setFranchises(d.franchises ?? []))
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
  }, [open])

  const filteredLocations = selectedFranchiseId
    ? locations.filter((l) => l.franchiseId === selectedFranchiseId)
    : locations

  const availableRoles = INVITABLE_ROLES.filter((r) => {
    if (actorRole === "ADMIN") return true
    if (actorRole === "FRANCHISE_MANAGER")
      return ["SUPERVISOR", "TECHNICIAN", "STORE_USER"].includes(r.value)
    if (actorRole === "SUPERVISOR") return r.value === "STORE_USER"
    return false
  })

  const onSubmit = async (data: FormData) => {
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Invitation sent", description: `Invitation sent to ${data.email}` })
      reset()
      setOpen(false)
      onSuccess?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Email address</Label>
            <Input type="email" placeholder="user@example.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select onValueChange={(v) => setValue("role", v as Role)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {selectedRole && selectedRole !== "ADMIN" && (
            <div className="space-y-2">
              <Label>Franchise</Label>
              <Select
                onValueChange={(v) => {
                  setValue("franchiseId", v)
                  setValue("locationId", undefined)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select franchise" />
                </SelectTrigger>
                <SelectContent>
                  {franchises.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedRole && !["ADMIN", "FRANCHISE_MANAGER"].includes(selectedRole) && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Select onValueChange={(v) => setValue("locationId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {filteredLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      {!selectedFranchiseId && ` — ${l.franchise.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
