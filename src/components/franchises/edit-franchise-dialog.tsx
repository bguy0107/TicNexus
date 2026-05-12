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
import { useSession } from "@/lib/auth-client"
import { hasPermission } from "@/lib/permissions"
import { X } from "lucide-react"
import type { FranchiseWithDetails, Role } from "@/types"

interface FranchiseSummary {
  id: string
  name: string
}

interface Manager {
  id: string
  firstName: string
  lastName: string
  email: string
}
interface Location {
  id: string
  name: string
  address: string | null
}

interface FranchiseDetail {
  id: string
  name: string
  maintenanceCostLimit: string | number | null
  itCostLimit: string | number | null
  locations: Location[]
  userFranchises: { user: Manager }[]
}

interface EditFranchiseDialogProps {
  franchise: FranchiseWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditFranchiseDialog({
  franchise,
  open,
  onOpenChange,
  onSuccess,
}: EditFranchiseDialogProps) {
  const [detail, setDetail] = useState<FranchiseDetail | null>(null)
  const [allFMUsers, setAllFMUsers] = useState<Manager[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [name, setName] = useState("")
  const [maintenanceCostLimit, setMaintenanceCostLimit] = useState("")
  const [itCostLimit, setItCostLimit] = useState("")
  const [currentManagerIds, setCurrentManagerIds] = useState<string[]>([])
  const [currentLocationIds, setCurrentLocationIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0)
  const [deleting, setDeleting] = useState(false)

  const [locationAction, setLocationAction] = useState<{ location: Location } | null>(null)
  const [locationActionChoice, setLocationActionChoice] = useState<"delete" | "reassign">("delete")
  const [reassignFranchiseId, setReassignFranchiseId] = useState("")
  const [otherFranchises, setOtherFranchises] = useState<FranchiseSummary[]>([])
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  const [savingLocationAction, setSavingLocationAction] = useState(false)

  const { toast } = useToast()
  const { data: session } = useSession()
  const actorRole = (session?.user as { role?: Role })?.role ?? "STORE_USER"
  const canDelete = hasPermission(actorRole, "franchise:delete")
  const canRemoveLocations = actorRole === "ADMIN"
  const canSetCostLimit = hasPermission(actorRole, "franchise:set_cost_limit")

  useEffect(() => {
    if (!open) return
    setDeleteStep(0)
    setDeleting(false)

    setLoadingDetail(true)
    Promise.all([
      fetch(`/api/franchises/${franchise.id}`).then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([franchiseData, usersData]) => {
      setDetail(franchiseData)
      setName(franchiseData.name)
      setMaintenanceCostLimit(
        franchiseData.maintenanceCostLimit != null ? String(franchiseData.maintenanceCostLimit) : ""
      )
      setItCostLimit(franchiseData.itCostLimit != null ? String(franchiseData.itCostLimit) : "")
      setCurrentManagerIds(franchiseData.userFranchises.map((uf: { user: Manager }) => uf.user.id))
      setCurrentLocationIds(franchiseData.locations.map((l: Location) => l.id))
      setAllFMUsers(
        (usersData.users ?? []).filter((u: { role: string }) => u.role === "FRANCHISE_MANAGER")
      )
      setLoadingDetail(false)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!locationAction) return
    setLocationActionChoice("delete")
    setReassignFranchiseId("")
    setLoadingFranchises(true)
    fetch("/api/franchises")
      .then((r) => r.json())
      .then((data) => {
        setOtherFranchises(
          (data.franchises ?? []).filter((f: FranchiseSummary) => f.id !== franchise.id)
        )
        setLoadingFranchises(false)
      })
  }, [locationAction, franchise.id])

  const handleLocationAction = async () => {
    if (!locationAction) return
    setSavingLocationAction(true)

    let res: Response
    if (locationActionChoice === "delete") {
      res = await fetch(`/api/locations/${locationAction.location.id}`, { method: "DELETE" })
    } else {
      if (!reassignFranchiseId) {
        setSavingLocationAction(false)
        return
      }
      res = await fetch(`/api/locations/${locationAction.location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: reassignFranchiseId }),
      })
    }

    const data = res.ok ? null : await res.json()
    setSavingLocationAction(false)

    if (!res.ok) {
      toast({ title: "Error", description: data?.error, variant: "destructive" })
      return
    }

    const label =
      locationActionChoice === "delete"
        ? `${locationAction.location.name} deleted`
        : `${locationAction.location.name} reassigned`
    toast({ title: label })
    setLocationAction(null)

    const updated = await fetch(`/api/franchises/${franchise.id}`).then((r) => r.json())
    setDetail(updated)
    setCurrentLocationIds(updated.locations.map((l: Location) => l.id))
  }

  const originalManagerIds = detail?.userFranchises.map((uf) => uf.user.id) ?? []
  const originalLocationIds = detail?.locations.map((l) => l.id) ?? []

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)

    const addManagerIds = currentManagerIds.filter((id) => !originalManagerIds.includes(id))
    const removeManagerIds = originalManagerIds.filter((id) => !currentManagerIds.includes(id))
    const removeLocationIds = originalLocationIds.filter((id) => !currentLocationIds.includes(id))

    const body: Record<string, unknown> = {}
    if (name.trim() !== detail.name) body.name = name.trim()
    const parsedMaintLimit =
      maintenanceCostLimit.trim() !== "" ? parseFloat(maintenanceCostLimit) : null
    const originalMaintLimit =
      detail.maintenanceCostLimit != null ? Number(detail.maintenanceCostLimit) : null
    if (parsedMaintLimit !== originalMaintLimit) body.maintenanceCostLimit = parsedMaintLimit

    const parsedItLimit = itCostLimit.trim() !== "" ? parseFloat(itCostLimit) : null
    const originalItLimit = detail.itCostLimit != null ? Number(detail.itCostLimit) : null
    if (parsedItLimit !== originalItLimit) body.itCostLimit = parsedItLimit
    if (addManagerIds.length) body.addManagerIds = addManagerIds
    if (removeManagerIds.length) body.removeManagerIds = removeManagerIds
    if (removeLocationIds.length) body.removeLocationIds = removeLocationIds

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      setSaving(false)
      return
    }

    const res = await fetch(`/api/franchises/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Franchise updated" })
      onOpenChange(false)
      onSuccess()
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    setDeleting(true)
    const res = await fetch(`/api/franchises/${detail.id}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      toast({ title: "Franchise deleted", description: `${detail.name} has been deleted.` })
      onOpenChange(false)
      onSuccess()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
      setDeleteStep(0)
    }
  }

  const currentManagers =
    detail?.userFranchises.map((uf) => uf.user).filter((u) => currentManagerIds.includes(u.id)) ??
    []

  const availableFMUsers = allFMUsers.filter((u) => !currentManagerIds.includes(u.id))

  const currentLocations = detail?.locations.filter((l) => currentLocationIds.includes(l.id)) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {franchise.name}</DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Franchise name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {canSetCostLimit && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Supervisor approval cost limits</p>
                    <p className="text-xs text-muted-foreground">
                      Supervisors may only approve tickets whose cost is at or below the limit for
                      that ticket type. Leave blank for no restriction.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="maintenance-cost-limit">Maintenance limit ($)</Label>
                      <Input
                        id="maintenance-cost-limit"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="No limit"
                        value={maintenanceCostLimit}
                        onChange={(e) => setMaintenanceCostLimit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="it-cost-limit">IT limit ($)</Label>
                      <Input
                        id="it-cost-limit"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="No limit"
                        value={itCostLimit}
                        onChange={(e) => setItCostLimit(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Franchise Managers */}
            <div className="space-y-3">
              <Label>Franchise managers</Label>
              <div className="flex flex-wrap gap-2 min-h-8">
                {currentManagers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No managers assigned</span>
                ) : (
                  currentManagers.map((m) => (
                    <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                      {m.firstName} {m.lastName}
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentManagerIds((prev) => prev.filter((id) => id !== m.id))
                        }
                        className="ml-1 rounded-sm hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              {availableFMUsers.length > 0 && (
                <Select
                  value=""
                  onValueChange={(id) => setCurrentManagerIds((prev) => [...prev, id])}
                >
                  <SelectTrigger className="text-muted-foreground">
                    <SelectValue placeholder="Add manager…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFMUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                        <span className="ml-2 text-muted-foreground text-xs">{u.email}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Locations */}
            <div className="space-y-3">
              <Label>Locations</Label>
              {currentLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locations</p>
              ) : (
                <ul className="space-y-1">
                  {currentLocations.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        {l.name}
                        {l.address && (
                          <span className="ml-2 text-muted-foreground text-xs">{l.address}</span>
                        )}
                      </span>
                      {canRemoveLocations && (
                        <button
                          type="button"
                          onClick={() => setLocationAction({ location: l })}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Location action sub-dialog */}
        <Dialog
          open={!!locationAction}
          onOpenChange={(open) => {
            if (!open) setLocationAction(null)
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {locationAction?.location.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="locationAction"
                    value="delete"
                    checked={locationActionChoice === "delete"}
                    onChange={() => setLocationActionChoice("delete")}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Delete location entirely</span>
                    <span className="block text-muted-foreground text-xs mt-0.5">
                      Permanently removes this location from the system.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="locationAction"
                    value="reassign"
                    checked={locationActionChoice === "reassign"}
                    onChange={() => setLocationActionChoice("reassign")}
                    className="mt-0.5"
                  />
                  <span className="text-sm font-medium">Assign to a different franchise</span>
                </label>
              </div>
              {locationActionChoice === "reassign" && (
                <div className="pl-6">
                  {loadingFranchises ? (
                    <p className="text-sm text-muted-foreground">Loading franchises…</p>
                  ) : otherFranchises.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No other franchises available.</p>
                  ) : (
                    <Select value={reassignFranchiseId} onValueChange={setReassignFranchiseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select franchise…" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherFranchises.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLocationAction(null)}
                disabled={savingLocationAction}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLocationAction}
                disabled={
                  savingLocationAction ||
                  (locationActionChoice === "reassign" && !reassignFranchiseId)
                }
                variant="default"
              >
                {savingLocationAction ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            {canDelete && !loadingDetail && (
              <>
                {deleteStep === 0 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteStep(1)}
                    disabled={saving || deleting}
                  >
                    Delete franchise
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-destructive">
                      Delete {detail?.name} and all {franchise._count.locations} location(s)? This
                      cannot be undone.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteStep(0)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          {deleteStep === 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || loadingDetail}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
