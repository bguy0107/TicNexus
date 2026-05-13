"use client"

import { useState, useEffect, useRef } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import type { LocationWithDetails } from "@/types"

interface CreateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateTicketDialog({ open, onOpenChange, onSuccess }: CreateTicketDialogProps) {
  const { toast } = useToast()
  const [locations, setLocations] = useState<LocationWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: "",
    issue: "",
    locationId: "",
    deadline: "",
  })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
  }, [open])

  const handleSubmit = async () => {
    if (!form.type || !form.issue.trim() || !form.locationId) return

    const file = fileRef.current?.files?.[0]
    if (file) {
      const isVideo = file.type.startsWith("video/")
      const limitBytes = isVideo ? 75 * 1024 * 1024 : 50 * 1024 * 1024
      const limitLabel = isVideo ? "75 MB" : "50 MB"
      if (file.size > limitBytes) {
        toast({
          title: "File too large",
          description: `Maximum upload size is ${limitLabel}.`,
          variant: "destructive",
        })
        return
      }
    }

    setLoading(true)

    const fd = new FormData()
    fd.append("type", form.type)
    fd.append("issue", form.issue.trim())
    fd.append("locationId", form.locationId)
    if (form.deadline) fd.append("deadline", form.deadline)
    if (file) fd.append("file", file)

    const res = await fetch("/api/tickets", { method: "POST", body: fd })
    setLoading(false)

    if (res.ok) {
      toast({ title: "Ticket created" })
      setForm({ type: "", issue: "", locationId: "", deadline: "" })
      if (fileRef.current) fileRef.current.value = ""
      onOpenChange(false)
      onSuccess()
    } else {
      let message = "Something went wrong"
      try {
        const data = await res.json()
        message = data.error ?? message
      } catch {}
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Select
              value={form.locationId}
              onValueChange={(v) => setForm({ ...form, locationId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.locationNumber} — {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Issue description</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Describe the issue..."
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Deadline (optional)</Label>
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <Input type="file" accept="image/*,video/*" ref={fileRef} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.type || !form.issue.trim() || !form.locationId}
          >
            {loading ? "Creating..." : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
