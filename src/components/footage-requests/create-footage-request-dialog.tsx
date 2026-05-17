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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import type { LocationWithDetails } from "@/types"

interface CreateFootageRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateFootageRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateFootageRequestDialogProps) {
  const { toast } = useToast()
  const [locations, setLocations] = useState<LocationWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    locationId: "",
    startDateTime: "",
    endDateTime: "",
    cameraArea: "",
    requestingParty: "",
    officerContact: "",
    sendTo: "",
    lookingFor: "",
  })

  useEffect(() => {
    if (!open) return
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
  }, [open])

  const isLawEnforcement = form.requestingParty === "LAW_ENFORCEMENT"
  const isInternal = form.requestingParty === "INTERNAL"

  const isValid =
    form.locationId &&
    form.startDateTime &&
    form.endDateTime &&
    form.cameraArea.trim() &&
    form.requestingParty &&
    (!isLawEnforcement || (form.officerContact.trim() && form.lookingFor.trim())) &&
    (!isInternal || (form.sendTo.trim() && form.lookingFor.trim()))

  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)

    const res = await fetch("/api/footage-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: form.locationId,
        startDateTime: form.startDateTime,
        endDateTime: form.endDateTime,
        cameraArea: form.cameraArea.trim(),
        requestingParty: form.requestingParty,
        officerContact: isLawEnforcement ? form.officerContact.trim() : undefined,
        lookingFor: form.lookingFor.trim() || undefined,
        sendTo: isInternal ? form.sendTo.trim() : undefined,
      }),
    })

    setLoading(false)

    if (res.ok) {
      toast({ title: "Footage request submitted" })
      setForm({
        locationId: "",
        startDateTime: "",
        endDateTime: "",
        cameraArea: "",
        requestingParty: "",
        officerContact: "",
        sendTo: "",
        lookingFor: "",
      })
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
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New footage request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Location</Label>
            <Select
              value={form.locationId}
              onValueChange={(v) => setForm({ ...form, locationId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="w-[var(--radix-select-trigger-width)]"
              >
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.locationNumber} — {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date &amp; time</Label>
              <Input
                type="datetime-local"
                value={form.startDateTime}
                onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End date &amp; time</Label>
              <Input
                type="datetime-local"
                value={form.endDateTime}
                onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Camera / area</Label>
            <Input
              placeholder="e.g. Front entrance camera, Back parking lot"
              value={form.cameraArea}
              onChange={(e) => setForm({ ...form, cameraArea: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Requesting party</Label>
            <Select
              value={form.requestingParty}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  requestingParty: v,
                  officerContact: "",
                  sendTo: "",
                  lookingFor: "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="LAW_ENFORCEMENT">Law Enforcement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLawEnforcement && (
            <>
              <div className="space-y-2">
                <Label>
                  Contact information of officer <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Badge #1234, (555) 123-4567"
                  value={form.officerContact}
                  onChange={(e) => setForm({ ...form, officerContact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  What are we looking for? <span className="text-destructive">*</span>
                </Label>
                <textarea
                  placeholder="Describe what to look for in the footage..."
                  value={form.lookingFor}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setForm({ ...form, lookingFor: e.target.value })
                  }
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </>
          )}

          {isInternal && (
            <>
              <div className="space-y-2">
                <Label>
                  Who should footage be sent to? <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. John Smith, Loss Prevention"
                  value={form.sendTo}
                  onChange={(e) => setForm({ ...form, sendTo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  What are we looking for? <span className="text-destructive">*</span>
                </Label>
                <textarea
                  placeholder="Describe what to look for in the footage..."
                  value={form.lookingFor}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setForm({ ...form, lookingFor: e.target.value })
                  }
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
