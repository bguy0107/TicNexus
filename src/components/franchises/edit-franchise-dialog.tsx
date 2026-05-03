"use client"

import { useState, useEffect } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { X, Plus } from "lucide-react"
import type { FranchiseWithDetails } from "@/types"

interface Manager { id: string; firstName: string; lastName: string; email: string }
interface Location { id: string; name: string; address: string | null }
interface NewLocation { tempId: string; name: string; address: string }

interface FranchiseDetail {
  id: string
  name: string
  locations: Location[]
  userFranchises: { user: Manager }[]
}

interface EditFranchiseDialogProps {
  franchise: FranchiseWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditFranchiseDialog({ franchise, open, onOpenChange, onSuccess }: EditFranchiseDialogProps) {
  const [detail, setDetail] = useState<FranchiseDetail | null>(null)
  const [allFMUsers, setAllFMUsers] = useState<Manager[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [name, setName] = useState("")
  const [currentManagerIds, setCurrentManagerIds] = useState<string[]>([])
  const [currentLocationIds, setCurrentLocationIds] = useState<string[]>([])
  const [newLocations, setNewLocations] = useState<NewLocation[]>([])
  const [newLocName, setNewLocName] = useState("")
  const [newLocAddress, setNewLocAddress] = useState("")

  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setNewLocations([])
    setNewLocName("")
    setNewLocAddress("")

    setLoadingDetail(true)
    Promise.all([
      fetch(`/api/franchises/${franchise.id}`).then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([franchiseData, usersData]) => {
      setDetail(franchiseData)
      setName(franchiseData.name)
      setCurrentManagerIds(franchiseData.userFranchises.map((uf: { user: Manager }) => uf.user.id))
      setCurrentLocationIds(franchiseData.locations.map((l: Location) => l.id))
      setAllFMUsers(
        (usersData.users ?? []).filter((u: { role: string }) => u.role === "FRANCHISE_MANAGER")
      )
      setLoadingDetail(false)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const originalManagerIds = detail?.userFranchises.map((uf) => uf.user.id) ?? []
  const originalLocationIds = detail?.locations.map((l) => l.id) ?? []

  const handleAddNewLocation = () => {
    if (!newLocName.trim()) return
    setNewLocations((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name: newLocName.trim(), address: newLocAddress.trim() },
    ])
    setNewLocName("")
    setNewLocAddress("")
  }

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)

    const addManagerIds = currentManagerIds.filter((id) => !originalManagerIds.includes(id))
    const removeManagerIds = originalManagerIds.filter((id) => !currentManagerIds.includes(id))
    const removeLocationIds = originalLocationIds.filter((id) => !currentLocationIds.includes(id))

    const body: Record<string, unknown> = {}
    if (name.trim() !== detail.name) body.name = name.trim()
    if (addManagerIds.length) body.addManagerIds = addManagerIds
    if (removeManagerIds.length) body.removeManagerIds = removeManagerIds
    if (newLocations.length) body.addLocations = newLocations.map(({ name: n, address: a }) => ({ name: n, address: a || undefined }))
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

  const currentManagers = detail?.userFranchises
    .map((uf) => uf.user)
    .filter((u) => currentManagerIds.includes(u.id)) ?? []

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
                        onClick={() => setCurrentManagerIds((prev) => prev.filter((id) => id !== m.id))}
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

              {/* Existing locations */}
              {currentLocations.length === 0 && newLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locations</p>
              ) : (
                <ul className="space-y-1">
                  {currentLocations.map((l) => (
                    <li key={l.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>
                        {l.name}
                        {l.address && <span className="ml-2 text-muted-foreground text-xs">{l.address}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentLocationIds((prev) => prev.filter((id) => id !== l.id))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {/* Queued new locations */}
                  {newLocations.map((l) => (
                    <li key={l.tempId} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <span>
                        {l.name}
                        {l.address && <span className="ml-2 text-xs">{l.address}</span>}
                        <span className="ml-2 text-xs">(new)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewLocations((prev) => prev.filter((n) => n.tempId !== l.tempId))}
                        className="hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add new location */}
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <p className="text-xs text-muted-foreground font-medium">Add location</p>
                <Input
                  placeholder="Location name"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNewLocation()}
                />
                <Input
                  placeholder="Address (optional)"
                  value={newLocAddress}
                  onChange={(e) => setNewLocAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNewLocation()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleAddNewLocation}
                  disabled={!newLocName.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingDetail}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
