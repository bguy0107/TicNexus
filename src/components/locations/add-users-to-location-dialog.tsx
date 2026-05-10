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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface AddUsersToLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableUsers: User[]
  onAdd: (userIds: string[]) => void
}

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AddUsersToLocationDialog({
  open,
  onOpenChange,
  availableUsers,
  onAdd,
}: AddUsersToLocationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) {
      setSelectedIds([])
      setSearch("")
    }
  }, [open])

  const filtered = availableUsers.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAdd = () => {
    onAdd(selectedIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Users To Location</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="space-y-1 max-h-72 overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {availableUsers.length === 0
                  ? "No users available to add"
                  : "No users match your search"}
              </p>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer select-none"
                  onClick={() => toggleUser(u.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(u.id)}
                    onCheckedChange={() => toggleUser(u.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {roleLabel(u.role)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleAdd}
            disabled={selectedIds.length === 0}
          >
            Add{selectedIds.length > 0 ? ` ${selectedIds.length}` : ""}{" "}
            {selectedIds.length === 1 ? "User" : "Users"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
