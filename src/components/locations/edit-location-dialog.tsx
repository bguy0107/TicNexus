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
import { X } from "lucide-react"
import type { LocationWithDetails } from "@/types"

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
  locationNumber: string | null
  address: string | null
  franchiseId: string
  franchise: { id: string; name: string }
  userLocations: { user: AssignedUser }[]
}

interface Franchise { id: string; name: string }
interface AllUser { id: string; firstName: string; lastName: string; email: string; role: string }

interface EditLocationDialogProps {
  location: LocationWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditLocationDialog({ location, open, onOpenChange, onSuccess }: EditLocationDialogProps) {
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
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setLoadingDetail(true)
    Promise.all([
      fetch(`/api/locations/${location.id}`).then((r) => r.json()),
      fetch("/api/franchises").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([locData, franData, usersData]) => {
      setDetail(locData)
      setName(locData.name)
      setLocationNumber(locData.locationNumber ?? "")
      setAddress(locData.address ?? "")
      setFranchiseId(locData.franchiseId)
      setCurrentUserIds(locData.userLocations.map((ul: { user: AssignedUser }) => ul.user.id))
      setAllFranchises(franData.franchises ?? [])
      setAllUsers((usersData.users ?? []).filter((u: AllUser & { deletedAt: unknown }) => !u.deletedAt))
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
    if (name !== detail.name) body.name = name
    if (address !== (detail.address ?? "")) body.address = address
    if (locationNumber !== (detail.locationNumber ?? "")) body.locationNumber = locationNumber
    if (franchiseId !== detail.franchiseId) body.franchiseId = franchiseId
    if (addUserIds.length) body.addUserIds = addUserIds
    if (removeUserIds.length) body.removeUserIds = removeUserIds

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

  const assignedUsers = allUsers.filter((u) => currentUserIds.includes(u.id))
  const unassignedUsers = allUsers.filter((u) => !currentUserIds.includes(u.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {location.name}</DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <div className="space-y-6 py-2">

            {/* Core fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Location ID number</Label>
                <Input
                  value={locationNumber}
                  onChange={(e) => setLocationNumber(e.target.value)}
                  placeholder="e.g. 001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
            </div>

            <Separator />

            {/* Franchise */}
            <div className="space-y-2">
              <Label>Franchise</Label>
              <Select value={franchiseId} onValueChange={setFranchiseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allFranchises.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* User assignments */}
            <div className="space-y-3">
              <Label>Assigned users</Label>
              <div className="flex flex-wrap gap-2 min-h-8">
                {assignedUsers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No users assigned</span>
                ) : (
                  assignedUsers.map((u) => (
                    <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                      {u.firstName} {u.lastName}
                      <span className="text-muted-foreground text-xs ml-1">
                        {u.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentUserIds((prev) => prev.filter((id) => id !== u.id))}
                        className="ml-1 rounded-sm hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              {unassignedUsers.length > 0 && (
                <Select value="" onValueChange={(id) => setCurrentUserIds((prev) => [...prev, id])}>
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
              )}
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingDetail || !name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
