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

interface Location {
  id: string
  name: string
  franchise: { name: string }
}

interface LocationAssignmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allLocations: Location[]
  currentIds: string[]
  onSave: (newIds: string[]) => void
}

export function LocationAssignmentsDialog({
  open,
  onOpenChange,
  allLocations,
  currentIds,
  onSave,
}: LocationAssignmentsDialogProps) {
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
          <DialogTitle>Location Assignments</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-1 max-h-72 overflow-y-auto">
          {allLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No locations available.</p>
          ) : (
            allLocations.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                onClick={() => toggle(l.id)}
              >
                <Checkbox
                  id={`location-${l.id}`}
                  checked={selectedIds.includes(l.id)}
                  onCheckedChange={() => toggle(l.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label htmlFor={`location-${l.id}`} className="cursor-pointer flex-1">
                  {l.name}
                  <span className="ml-1 font-normal text-muted-foreground text-xs">
                    ({l.franchise.name})
                  </span>
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
