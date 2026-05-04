"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Building2, UserPlus, MapPin } from "lucide-react"
import type { Role } from "@prisma/client"

type DialogType = "franchise" | "user" | "location" | null

interface Franchise {
  id: string
  name: string
}

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "FRANCHISE_MANAGER", label: "Franchise Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "STORE_USER", label: "Store User" },
]

const INVITE_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  ...ALL_ROLES,
]

export function QuickActions() {
  const [open, setOpen] = useState<DialogType>(null)
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  // Add Franchise state
  const [franchiseName, setFranchiseName] = useState("")

  // Invite User state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role | "">("")
  const [inviteDept, setInviteDept] = useState<"IT" | "MAINTENANCE" | "">("")
  const [inviteFranchiseId, setInviteFranchiseId] = useState("")

  // Create User directly state
  const [createEmail, setCreateEmail] = useState("")
  const [createFirstName, setCreateFirstName] = useState("")
  const [createLastName, setCreateLastName] = useState("")
  const [createRole, setCreateRole] = useState<Role | "">("")
  const [createDept, setCreateDept] = useState<"IT" | "MAINTENANCE" | "">("")
  const [createPassword, setCreatePassword] = useState("")

  // Add Location state
  const [locForm, setLocForm] = useState({ name: "", locationNumber: "", address: "", franchiseId: "" })

  useEffect(() => {
    if (open === "user" || open === "location") {
      fetch("/api/franchises")
        .then((r) => r.json())
        .then((d) => setFranchises(d.franchises ?? []))
    }
  }, [open])

  function resetAll() {
    setFranchiseName("")
    setInviteEmail(""); setInviteRole(""); setInviteDept(""); setInviteFranchiseId("")
    setCreateEmail(""); setCreateFirstName(""); setCreateLastName("")
    setCreateRole(""); setCreateDept(""); setCreatePassword("")
    setLocForm({ name: "", locationNumber: "", address: "", franchiseId: "" })
  }

  function closeDialog() {
    setOpen(null)
    resetAll()
  }

  async function handleAddFranchise() {
    if (!franchiseName.trim()) return
    setSubmitting(true)
    const res = await fetch("/api/franchises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: franchiseName.trim() }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      toast({ title: "Franchise created", description: `${franchiseName} has been created.` })
      closeDialog()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  async function handleInviteUser() {
    if (!inviteEmail || !inviteRole) return
    if (inviteRole === "TECHNICIAN" && !inviteDept) return
    setSubmitting(true)
    const body: Record<string, string> = { email: inviteEmail, role: inviteRole }
    if (inviteDept) body.department = inviteDept
    if (inviteFranchiseId) body.franchiseId = inviteFranchiseId
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      toast({ title: "Invitation sent", description: `Invitation sent to ${inviteEmail}` })
      closeDialog()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  async function handleCreateUser() {
    if (!createEmail || !createFirstName || !createLastName || !createRole || !createPassword) return
    if (createRole === "TECHNICIAN" && !createDept) return
    setSubmitting(true)
    const body: Record<string, string> = {
      email: createEmail,
      firstName: createFirstName,
      lastName: createLastName,
      role: createRole,
      password: createPassword,
    }
    if (createDept) body.department = createDept
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      toast({ title: "User created", description: `${createFirstName} ${createLastName} has been created and will be prompted to change their password on first login.` })
      closeDialog()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  async function handleAddLocation() {
    if (!locForm.name.trim() || !locForm.franchiseId) return
    setSubmitting(true)
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locForm),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      toast({ title: "Location created", description: `${locForm.name} has been created.` })
      closeDialog()
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2 min-h-[44px]" onClick={() => setOpen("franchise")}>
            <Building2 className="h-4 w-4" />
            Add Franchise
          </Button>
          <Button size="sm" variant="outline" className="gap-2 min-h-[44px]" onClick={() => setOpen("user")}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
          <Button size="sm" variant="outline" className="gap-2 min-h-[44px]" onClick={() => setOpen("location")}>
            <MapPin className="h-4 w-4" />
            Add Location
          </Button>
        </CardContent>
      </Card>

      {/* Add Franchise Dialog */}
      <Dialog open={open === "franchise"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Franchise</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Franchise name</Label>
            <Input
              placeholder="e.g. Acme Corp"
              value={franchiseName}
              onChange={(e) => setFranchiseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFranchise()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleAddFranchise} disabled={submitting || !franchiseName.trim()}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog — Invite or Create tabs */}
      <Dialog open={open === "user"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="create">
            <TabsList className="w-full">
              <TabsTrigger value="create" className="flex-1">Create directly</TabsTrigger>
              <TabsTrigger value="invite" className="flex-1">Send invitation</TabsTrigger>
            </TabsList>

            {/* Create directly tab */}
            <TabsContent value="create" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input placeholder="Jane" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input placeholder="Smith" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input type="email" placeholder="user@example.com" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={(v) => { setCreateRole(v as Role); setCreateDept("") }}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {createRole === "TECHNICIAN" && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select onValueChange={(v) => setCreateDept(v as "IT" | "MAINTENANCE")}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Initial password</Label>
                <Input type="password" placeholder="Min 8 characters" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">User will be required to change this on first login.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={
                    submitting ||
                    !createEmail || !createFirstName || !createLastName ||
                    !createRole || !createPassword ||
                    (createRole === "TECHNICIAN" && !createDept)
                  }
                >
                  {submitting ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Send invitation tab */}
            <TabsContent value="invite" className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input type="email" placeholder="user@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={(v) => { setInviteRole(v as Role); setInviteDept("") }}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "TECHNICIAN" && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select onValueChange={(v) => setInviteDept(v as "IT" | "MAINTENANCE")}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {inviteRole && inviteRole !== "ADMIN" && (
                <div className="space-y-2">
                  <Label>Franchise</Label>
                  <Select onValueChange={(v) => setInviteFranchiseId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select franchise" /></SelectTrigger>
                    <SelectContent>
                      {franchises.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button
                  onClick={handleInviteUser}
                  disabled={
                    submitting ||
                    !inviteEmail || !inviteRole ||
                    (inviteRole === "TECHNICIAN" && !inviteDept)
                  }
                >
                  {submitting ? "Sending…" : "Send invitation"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={open === "location"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location name</Label>
              <Input placeholder="e.g. Downtown Store" value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Location number (optional)</Label>
              <Input placeholder="e.g. 001" value={locForm.locationNumber} onChange={(e) => setLocForm((f) => ({ ...f, locationNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input placeholder="123 Main St" value={locForm.address} onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Franchise</Label>
              <Select onValueChange={(v) => setLocForm((f) => ({ ...f, franchiseId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select franchise" /></SelectTrigger>
                <SelectContent>
                  {franchises.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleAddLocation} disabled={submitting || !locForm.name.trim() || !locForm.franchiseId}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
