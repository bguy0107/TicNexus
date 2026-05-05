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
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/lib/auth-client"
import { hasPermission, isHigherRole } from "@/lib/permissions"
import { ChangePasswordDialog } from "./change-password-dialog"
import { FranchiseAssignmentsDialog } from "./franchise-assignments-dialog"
import { X } from "lucide-react"
import type { UserWithRelations, Role, Department } from "@/types"

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
  readOnly?: boolean
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess, readOnly = false }: EditUserDialogProps) {
  const { data: session } = useSession()
  const actorRole = (session?.user as { role?: Role })?.role ?? "STORE_USER"
  const isAdmin = actorRole === "ADMIN"

  const canChangeRole = hasPermission(actorRole, "user:update:role")
  const canChangeAssignments = hasPermission(actorRole, "user:update:assignments")
  const canManageFranchises = isAdmin || actorRole === "FRANCHISE_MANAGER"
  const canDeactivate =
    !user.deletedAt &&
    isHigherRole(actorRole, user.role) &&
    (hasPermission(actorRole, "user:deactivate:any") ||
      hasPermission(actorRole, "user:deactivate:below"))
  const canReactivate =
    !!user.deletedAt &&
    isHigherRole(actorRole, user.role) &&
    (hasPermission(actorRole, "user:reactivate:any") ||
      hasPermission(actorRole, "user:reactivate:below"))
  const canSetPassword = isAdmin && !user.deletedAt
  const canResetPasswordEmail =
    !isAdmin &&
    !user.deletedAt &&
    isHigherRole(actorRole, user.role) &&
    hasPermission(actorRole, "user:reset-password:below")

  const hasActions = canDeactivate || canReactivate || canSetPassword || canResetPasswordEmail

  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [role, setRole] = useState<Role>(user.role)
  const [department, setDepartment] = useState<Department | null>(user.department)
  const [allFranchises, setAllFranchises] = useState<Franchise[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [currentFranchiseIds, setCurrentFranchiseIds] = useState<string[]>([])
  const [currentLocationIds, setCurrentLocationIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showFranchiseDialog, setShowFranchiseDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setRole(user.role)
    setDepartment(user.department)
    setShowDeactivateConfirm(false)
    setCurrentFranchiseIds(user.userFranchises.map((uf) => uf.franchise.id))
    setCurrentLocationIds(user.userLocations.map((ul) => ul.location.id))
    if (readOnly) return
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
    if (department !== user.department) body.department = department
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

  const handleDeactivate = async () => {
    setActing(true)
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
    setActing(false)
    if (res.ok) {
      toast({
        title: "User deactivated",
        description: `${user.firstName} ${user.lastName} has been deactivated.`,
      })
      onOpenChange(false)
      onSuccess()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const handleReactivate = async () => {
    setActing(true)
    const res = await fetch(`/api/users/${user.id}/reactivate`, { method: "POST" })
    const data = await res.json()
    setActing(false)
    if (res.ok) {
      toast({
        title: "User reactivated",
        description: `${user.firstName} ${user.lastName} has been reactivated.`,
      })
      onOpenChange(false)
      onSuccess()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const handleForcePasswordChange = async () => {
    setActing(true)
    const res = await fetch(`/api/users/${user.id}/force-password-change`, { method: "POST" })
    const data = await res.json()
    setActing(false)
    if (res.ok) {
      toast({
        title: "Password change required",
        description: `${user.firstName} ${user.lastName} will be prompted to change their password on next login.`,
      })
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const assignedFranchises = allFranchises.filter((f) => currentFranchiseIds.includes(f.id))
  const assignedLocations = allLocations.filter((l) => currentLocationIds.includes(l.id))
  const unassignedLocations = allLocations.filter((l) => !currentLocationIds.includes(l.id))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {readOnly
                ? `${user.firstName} ${user.lastName}`
                : `Edit ${user.firstName} ${user.lastName}`}
            </DialogTitle>
          </DialogHeader>

          {readOnly ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">First name</Label>
                  <p className="text-sm">{user.firstName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Last name</Label>
                  <p className="text-sm">{user.lastName}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm">{user.email}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <p className="text-sm">
                  {ALL_ROLES.find((r) => r.value === user.role)?.label ?? user.role}
                </p>
              </div>
              {user.role === "TECHNICIAN" && user.department && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <p className="text-sm">{user.department === "IT" ? "IT" : "Maintenance"}</p>
                </div>
              )}
              {user.userFranchises.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Franchise assignments</Label>
                  <div className="flex flex-wrap gap-2">
                    {user.userFranchises.map((uf) => (
                      <Badge key={uf.franchise.id} variant="secondary">
                        {uf.franchise.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {user.userLocations.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Location assignments</Label>
                  <div className="flex flex-wrap gap-2">
                    {user.userLocations.map((ul) => (
                      <Badge key={ul.location.id} variant="secondary">
                        {ul.location.name}
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({ul.location.franchise.name})
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
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

              {canChangeRole && (
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
              )}

              {role === "TECHNICIAN" && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={department ?? ""}
                    onValueChange={(v) => setDepartment(v as Department)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canChangeAssignments && canManageFranchises && (
                <div className="space-y-2">
                  <Label>Franchise assignments</Label>
                  <div className="flex flex-wrap gap-2 min-h-8">
                    {assignedFranchises.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None assigned</span>
                    ) : (
                      assignedFranchises.map((f) => (
                        <Badge key={f.id} variant="secondary">
                          {f.name}
                        </Badge>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowFranchiseDialog(true)}
                  >
                    Change Franchise Assignments
                  </Button>
                </div>
              )}

              {canChangeAssignments && (
                <div className="space-y-2">
                  <Label>Location assignments</Label>
                  <div className="flex flex-wrap gap-2 min-h-8">
                    {assignedLocations.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None assigned</span>
                    ) : (
                      assignedLocations.map((l) => (
                        <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                          {l.name}
                          <span className="text-muted-foreground text-xs">
                            ({l.franchise.name})
                          </span>
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
              )}

              {hasActions && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {canReactivate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReactivate}
                        disabled={acting}
                        className="w-full sm:w-auto"
                      >
                        {acting ? "Reactivating…" : "Reactivate user"}
                      </Button>
                    )}

                    {canDeactivate && (
                      <div className="space-y-2">
                        {!showDeactivateConfirm ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeactivateConfirm(true)}
                            className="w-full sm:w-auto"
                          >
                            Deactivate user
                          </Button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-destructive">
                              Revokes access immediately. Continue?
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={handleDeactivate}
                              disabled={acting}
                            >
                              {acting ? "Deactivating…" : "Yes, deactivate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowDeactivateConfirm(false)}
                              disabled={acting}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {canSetPassword && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowPasswordDialog(true)}
                        className="w-full sm:w-auto"
                      >
                        Set password
                      </Button>
                    )}

                    {canResetPasswordEmail && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleForcePasswordChange}
                        disabled={acting}
                        className="w-full sm:w-auto"
                      >
                        {acting ? "Applying…" : "Force Password Change"}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {readOnly ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !!user.deletedAt}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canSetPassword && (
        <ChangePasswordDialog
          userId={user.id}
          userName={`${user.firstName} ${user.lastName}`}
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
        />
      )}

      {canChangeAssignments && canManageFranchises && (
        <FranchiseAssignmentsDialog
          open={showFranchiseDialog}
          onOpenChange={setShowFranchiseDialog}
          allFranchises={allFranchises}
          currentIds={currentFranchiseIds}
          onSave={setCurrentFranchiseIds}
        />
      )}
    </>
  )
}