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
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { Plus, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string
    name: string
    locationCount: number
  } | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleting, setDeleting] = useState(false)
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

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await fetch(`/api/franchises/${confirmDelete.id}`, { method: "DELETE" })
    setDeleting(false)
    setConfirmDelete(null)
    setDeleteStep(1)
    if (res.ok) {
      toast({ title: "Franchise deleted" })
      fetchFranchises()
    } else {
      const data = await res.json()
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
              {actorRole === "ADMIN" && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {franchises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No franchises found
                </TableCell>
              </TableRow>
            ) : (
              franchises.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{f._count.locations}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(f.createdAt)}
                  </TableCell>
                  {actorRole === "ADMIN" && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => setEditingFranchise(f)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => {
                              setConfirmDelete({
                                id: f.id,
                                name: f.name,
                                locationCount: f._count.locations,
                              })
                              setDeleteStep(1)
                            }}
                          >
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

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDelete(null)
            setDeleteStep(1)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete franchise</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-foreground">{confirmDelete?.name}</span>?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(null)
                    setDeleteStep(1)
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Delete franchise</DialogTitle>
                <DialogDescription>
                  Deleting{" "}
                  <span className="font-medium text-foreground">{confirmDelete?.name}</span> will
                  also delete{" "}
                  <span className="font-medium text-foreground">
                    {confirmDelete?.locationCount ?? 0} location
                    {confirmDelete?.locationCount !== 1 ? "s" : ""}
                  </span>{" "}
                  associated with it. Are you sure you want to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteStep(1)} disabled={deleting}>
                  Back
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete franchise"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
