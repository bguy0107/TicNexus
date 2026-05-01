"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { Plus, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LocationWithDetails, FranchiseWithDetails, Role } from "@/types"

export function LocationTable() {
  const { data: session } = useSession()
  const [locations, setLocations] = useState<LocationWithDetails[]>([])
  const [franchises, setFranchises] = useState<FranchiseWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", address: "", franchiseId: "" })
  const { toast } = useToast()

  const actorRole = (session?.user as { role?: Role })?.role
  const canCreate = actorRole === "ADMIN" || actorRole === "FRANCHISE_MANAGER"

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [locRes, franRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/franchises"),
    ])
    const [locData, franData] = await Promise.all([locRes.json(), franRes.json()])
    setLocations(locData.locations ?? [])
    setFranchises(franData.franchises ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.franchiseId) return
    setCreating(true)
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      toast({ title: "Location created" })
      setForm({ name: "", address: "", franchiseId: "" })
      setCreateOpen(false)
      fetchData()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete location "${name}"?`)) return
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Location deleted" })
      fetchData()
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Loading locations...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{locations.length} location(s)</p>
        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Location</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>New location</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Location name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Downtown Branch"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address (optional)</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Franchise</Label>
                  <Select onValueChange={(v) => setForm({ ...form, franchiseId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select franchise" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchises.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !form.name.trim() || !form.franchiseId}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Franchise</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Created</TableHead>
              {canCreate && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No locations found
                </TableCell>
              </TableRow>
            ) : (
              locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.franchise.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.address ?? "—"}</TableCell>
                  <TableCell>{l._count.userLocations}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(l.createdAt)}</TableCell>
                  {canCreate && actorRole === "ADMIN" && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => handleDelete(l.id, l.name)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
