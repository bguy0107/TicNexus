"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { Plus } from "lucide-react"
import { EditFranchiseDialog } from "./edit-franchise-dialog"
import type { FranchiseWithDetails, Role } from "@/types"

export function FranchiseTable() {
  const { data: session } = useSession()
  const [franchises, setFranchises] = useState<FranchiseWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingFranchise, setEditingFranchise] = useState<FranchiseWithDetails | null>(null)
  const { toast } = useToast()

  const fetchFranchises = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/franchises")
    const data = await res.json()
    setFranchises(data.franchises ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFranchises()
  }, [fetchFranchises])

  const actorRole = (session?.user as { role?: Role })?.role

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch("/api/franchises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      toast({ title: "Franchise created", description: `${newName} has been created.` })
      setNewName("")
      setCreateOpen(false)
      fetchFranchises()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Loading franchises...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{franchises.length} franchise(s)</p>
        {actorRole === "ADMIN" && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Franchise
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>New franchise</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Franchise name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Franchise Alpha"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {franchises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No franchises found
                </TableCell>
              </TableRow>
            ) : (
              franchises.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setEditingFranchise(f)}
                >
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{f._count.locations}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(f.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingFranchise && (
        <EditFranchiseDialog
          franchise={editingFranchise}
          open={!!editingFranchise}
          onOpenChange={(open) => {
            if (!open) setEditingFranchise(null)
          }}
          onSuccess={fetchFranchises}
        />
      )}
    </div>
  )
}
