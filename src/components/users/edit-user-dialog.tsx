"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { X } from "lucide-react"
import type { UserWithRelations, Role } from "@/types"

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "FRANCHISE_MANAGER", label: "Franchise Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "STORE_USER", label: "Store User" },
]

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

interface EditUserDialogProps {
  user: UserWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [role, setRole] = useState<Role>(user.role)
  const [allFranchises, setAllFranchises] = useState<Franchise[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [currentFranchiseIds, setCurrentFranchiseIds] = useState<string[]>([])
  const [currentLocationIds, setCurrentLocationIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setRole(user.role)
    setCurrentFranchiseIds(user.userFranchises.map((uf) => uf.franchise.id))
    setCurrentLocationIds(user.userLocations.map((ul) => ul.location.id))
    fetch("/api/franchises")
      .then((r) => r.json())
      .then((d) => setAllFranchises(d.franchises ?? []))
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setAllLocations(d.locations ?? []))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const originalFranchiseIds = user.userFranchises.map((uf) => uf.franchise.id)
  const originalLocationIds = user.userLocations.map((ul) => ul.location.id)

  const handleSave = async () => {
    setSaving(true)

    const addFranchiseIds = currentFranchiseIds.filter((id) => !originalFranchiseIds.includes(id))
    const removeFranchiseIds = originalFranchiseIds.filter(
      (id) => !currentFranchiseIds.includes(id)
    )
    const addLocationIds = currentLocationIds.filter((id) => !originalLocationIds.includes(id))
    const removeLocationIds = originalLocationIds.filter((id) => !currentLocationIds.includes(id))

    const body: Record<string, unknown> = {}
    if (firstName !== user.firstName) body.firstName = firstName
    if (lastName !== user.lastName) body.lastName = lastName
    if (role !== user.role) body.role = role
    if (addFranchiseIds.length) body.addFranchiseIds = addFranchiseIds
    if (removeFranchiseIds.length) body.removeFranchiseIds = removeFranchiseIds
    if (addLocationIds.length) body.addLocationIds = addLocationIds
    if (removeLocationIds.length) body.removeLocationIds = removeLocationIds

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      setSaving(false)
      return
    }

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "User updated", description: `${firstName} ${lastName} has been updated.` })
      onOpenChange(false)
      onSuccess()
    }
  }

  const assignedFranchises = allFranchises.filter((f) => currentFranchiseIds.includes(f.id))
  const unassignedFranchises = allFranchises.filter((f) => !currentFranchiseIds.includes(f.id))
  const assignedLocations = allLocations.filter((l) => currentLocationIds.includes(l.id))
  const unassignedLocations = allLocations.filter((l) => !currentLocationIds.includes(l.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {user.firstName} {user.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Franchise assignments</Label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {assignedFranchises.length === 0 ? (
                <span className="text-sm text-muted-foreground">None assigned</span>
              ) : (
                assignedFranchises.map((f) => (
                  <Badge key={f.id} variant="secondary" className="gap-1 pr-1">
                    {f.name}
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentFranchiseIds((prev) => prev.filter((id) => id !== f.id))
                      }
                      className="ml-1 rounded-sm hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            {unassignedFranchises.length > 0 && (
              <Select
                value=""
                onValueChange={(id) => setCurrentFranchiseIds((prev) => [...prev, id])}
              >
                <SelectTrigger className="text-muted-foreground">
                  <SelectValue placeholder="Add franchise…" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedFranchises.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Location assignments</Label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {assignedLocations.length === 0 ? (
                <span className="text-sm text-muted-foreground">None assigned</span>
              ) : (
                assignedLocations.map((l) => (
                  <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                    {l.name}
                    <span className="text-muted-foreground text-xs">({l.franchise.name})</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentLocationIds((prev) => prev.filter((id) => id !== l.id))
                      }
                      className="ml-1 rounded-sm hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            {unassignedLocations.length > 0 && (
              <Select
                value=""
                onValueChange={(id) => setCurrentLocationIds((prev) => [...prev, id])}
              >
                <SelectTrigger className="text-muted-foreground">
                  <SelectValue placeholder="Add location…" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} — {l.franchise.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
