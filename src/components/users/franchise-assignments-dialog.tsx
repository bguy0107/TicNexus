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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Franchise {
  id: string
  name: string
}

interface FranchiseAssignmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allFranchises: Franchise[]
  currentIds: string[]
  onSave: (newIds: string[]) => void
}

export function FranchiseAssignmentsDialog({
  open,
  onOpenChange,
  allFranchises,
  currentIds,
  onSave,
}: FranchiseAssignmentsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds)

  useEffect(() => {
    if (open) setSelectedIds(currentIds)
  }, [open, currentIds])

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Franchise Assignments</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-1 max-h-72 overflow-y-auto">
          {allFranchises.length === 0 ? (
            <p className="text-sm text-muted-foreground">No franchises available.</p>
          ) : (
            allFranchises.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                onClick={() => toggle(f.id)}
              >
                <Checkbox
                  id={`franchise-${f.id}`}
                  checked={selectedIds.includes(f.id)}
                  onCheckedChange={() => toggle(f.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label htmlFor={`franchise-${f.id}`} className="cursor-pointer flex-1">
                  {f.name}
                </Label>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(selectedIds)
              onOpenChange(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
