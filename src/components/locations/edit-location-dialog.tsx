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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { X } from "lucide-react"
import { hasPermission, isHigherRole } from "@/lib/permissions"
import { AddUsersToLocationDialog } from "./add-users-to-location-dialog"
import type { LocationWithDetails, Role } from "@/types"

interface AssignedUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  deletedAt: string | null
}

interface LocationDetail {
  id: string
  name: string
  locationNumber: string
  address: string | null
  franchiseId: string
  franchise: { id: string; name: string }
  userLocations: { user: AssignedUser }[]
}

interface Franchise {
  id: string
  name: string
}
interface AllUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface EditLocationDialogProps {
  location: LocationWithDetails
  actorRole: Role
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function EditLocationDialog({
  location,
  actorRole,
  open,
  onOpenChange,
  onSuccess,
}: EditLocationDialogProps) {
  const canEditLocation = hasPermission(actorRole, "location:update") // ADMIN, FM
  const isAdmin = actorRole === "ADMIN"
  const canEditAssignments = hasPermission(actorRole, "user:update:assignments") // ADMIN, FM, SUPERVISOR
  const isReadOnly = !canEditLocation && !canEditAssignments

  const [detail, setDetail] = useState<LocationDetail | null>(null)
  const [allFranchises, setAllFranchises] = useState<Franchise[]>([])
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [name, setName] = useState("")
  const [locationNumber, setLocationNumber] = useState("")
  const [address, setAddress] = useState("")
  const [franchiseId, setFranchiseId] = useState("")
  const [currentUserIds, setCurrentUserIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [showAddUsers, setShowAddUsers] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setLoadingDetail(true)

    const fetches: Promise<Response>[] = [fetch(`/api/locations/${location.id}`)]
    if (canEditLocation) fetches.push(fetch("/api/franchises"))
    if (canEditAssignments) fetches.push(fetch("/api/users"))

    Promise.all(fetches).then(async (responses) => {
      const locData: LocationDetail = await responses[0].json()
      setDetail(locData)
      setName(locData.name)
      setLocationNumber(locData.locationNumber)
      setAddress(locData.address ?? "")
      setFranchiseId(locData.franchiseId)
      setCurrentUserIds(locData.userLocations.map((ul) => ul.user.id))

      let idx = 1
      if (canEditLocation) {
        const franData = await responses[idx++].json()
        setAllFranchises(franData.franchises ?? [])
      }
      if (canEditAssignments) {
        const usersData = await responses[idx++].json()
        setAllUsers(
          (usersData.users ?? []).filter(
            (u: AllUser & { deletedAt: unknown }) =>
              !u.deletedAt && isHigherRole(actorRole, u.role as Role)
          )
        )
      }

      setLoadingDetail(false)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const originalUserIds = detail?.userLocations.map((ul) => ul.user.id) ?? []

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)

    const addUserIds = currentUserIds.filter((id) => !originalUserIds.includes(id))
    const removeUserIds = originalUserIds.filter((id) => !currentUserIds.includes(id))

    const body: Record<string, unknown> = {}
    if (canEditLocation) {
      if (name !== detail.name) body.name = name
      if (address !== (detail.address ?? "")) body.address = address
      if (isAdmin) {
        if (locationNumber !== detail.locationNumber) body.locationNumber = locationNumber
        if (franchiseId !== detail.franchiseId) body.franchiseId = franchiseId
      }
    }
    if (canEditAssignments) {
      if (addUserIds.length) body.addUserIds = addUserIds
      if (removeUserIds.length) body.removeUserIds = removeUserIds
    }

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      setSaving(false)
      return
    }

    const res = await fetch(`/api/locations/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Location updated" })
      onOpenChange(false)
      onSuccess()
    }
  }

  // Users the actor can interact with that are currently assigned
  const assignedUsers = allUsers.filter((u) => currentUserIds.includes(u.id))
  // Users assigned to the location but outside the actor's manageable scope (display only)
  const assignedOtherUsers =
    detail?.userLocations.filter(
      ({ user: u }) => currentUserIds.includes(u.id) && !allUsers.some((au) => au.id === u.id)
    ) ?? []
  const unassignedUsers = allUsers.filter((u) => !currentUserIds.includes(u.id))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isReadOnly ? location.name : `Edit ${location.name}`}</DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : isReadOnly ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Location ID</Label>
                  <p className="text-sm font-mono">{detail?.locationNumber || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Franchise</Label>
                  <p className="text-sm">{detail?.franchise.name}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="text-sm">{detail?.name}</p>
              </div>
              {detail?.address && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <p className="text-sm">{detail.address}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Assigned users</Label>
                {detail && detail.userLocations.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {detail.userLocations.map(({ user: u }) => (
                      <Badge key={u.id} variant="secondary">
                        {u.firstName} {u.lastName}
                        <span className="ml-1 font-normal text-muted-foreground text-xs">
                          {roleLabel(u.role)}
                        </span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No users assigned</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Location ID — editable by admin only */}
              <div className="space-y-2">
                <Label>Location ID</Label>
                {isAdmin ? (
                  <Input
                    value={locationNumber}
                    onChange={(e) => setLocationNumber(e.target.value)}
                    placeholder="e.g. 001"
                    className="font-mono"
                  />
                ) : (
                  <p className="text-sm font-mono text-muted-foreground">
                    {detail?.locationNumber || "—"}
                  </p>
                )}
              </div>

              {/* Name — editable by FM + admin */}
              <div className="space-y-2">
                <Label>Name</Label>
                {canEditLocation ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                ) : (
                  <p className="text-sm">{detail?.name}</p>
                )}
              </div>

              {/* Address — editable by FM + admin */}
              <div className="space-y-2">
                <Label>Address</Label>
                {canEditLocation ? (
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{detail?.address || "—"}</p>
                )}
              </div>

              <Separator />

              {/* Franchise — editable by admin only */}
              <div className="space-y-2">
                <Label>Franchise</Label>
                {isAdmin ? (
                  <Select value={franchiseId} onValueChange={setFranchiseId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allFranchises.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{detail?.franchise.name}</p>
                )}
              </div>

              <Separator />

              {/* User assignments */}
              <div className="space-y-3">
                <Label>Assigned users</Label>
                <div className="flex flex-wrap gap-2 min-h-8">
                  {assignedUsers.length === 0 && assignedOtherUsers.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No users assigned</span>
                  ) : (
                    <>
                      {assignedUsers.map((u) => (
                        <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                          {u.firstName} {u.lastName}
                          <span className="text-muted-foreground text-xs ml-1">
                            {roleLabel(u.role)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentUserIds((prev) => prev.filter((id) => id !== u.id))
                            }
                            className="ml-1 rounded-sm hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {assignedOtherUsers.map(({ user: u }) => (
                        <Badge key={u.id} variant="secondary">
                          {u.firstName} {u.lastName}
                          <span className="ml-1 font-normal text-muted-foreground text-xs">
                            {roleLabel(u.role)}
                          </span>
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
                {isAdmin ? (
                  unassignedUsers.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(id) => setCurrentUserIds((prev) => [...prev, id])}
                    >
                      <SelectTrigger className="text-muted-foreground">
                        <SelectValue placeholder="Add user…" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                            <span className="ml-2 text-muted-foreground text-xs">{u.email}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowAddUsers(true)}
                  >
                    Add Users To Location
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {isReadOnly ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    loadingDetail ||
                    (canEditLocation && !name.trim()) ||
                    (isAdmin && !locationNumber.trim())
                  }
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddUsersToLocationDialog
        open={showAddUsers}
        onOpenChange={setShowAddUsers}
        availableUsers={unassignedUsers}
        onAdd={(ids) => setCurrentUserIds((prev) => [...new Set([...prev, ...ids])])}
      />
    </>
  )
}
