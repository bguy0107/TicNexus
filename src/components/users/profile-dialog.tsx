"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, KeyRound, Loader2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { getInitials } from "@/lib/utils"
import { getRoleLabel } from "@/lib/permissions"
import { authClient } from "@/lib/auth-client"
import type { Role } from "@prisma/client"

interface ProfileData {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  phone: string | null
  image: string | null
}

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatPhone(digits: string): string {
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

const emptyPwForm = { current: "", next: "", confirm: "" }

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { toast } = useToast()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [phone, setPhone] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Password sub-dialog
  const [pwOpen, setPwOpen] = useState(false)
  const [pwForm, setPwForm] = useState(emptyPwForm)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data)
        setPhone(data.phone ?? "")
        setPreviewImage(data.image)
      })
      .catch(() => toast({ title: "Failed to load profile", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [open, toast])

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
    setPhone(digits)
  }

  const handleSavePhone = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || "" }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        toast({ title: error ?? "Failed to save phone number", variant: "destructive" })
        return
      }
      toast({ title: "Phone number saved" })
      if (profile) setProfile({ ...profile, phone: phone || null })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewImage(URL.createObjectURL(file))
    setUploading(true)
    try {
      const form = new FormData()
      form.append("avatar", file)
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: form })
      if (!res.ok) {
        const { error } = await res.json()
        toast({ title: error ?? "Upload failed", variant: "destructive" })
        setPreviewImage(profile?.image ?? null)
        return
      }
      const { imageUrl } = await res.json()
      setPreviewImage(imageUrl)
      if (profile) setProfile({ ...profile, image: imageUrl })
      toast({ title: "Profile picture updated — refresh to see it in the header" })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleRemoveAvatar = async () => {
    setUploading(true)
    try {
      const res = await fetch("/api/users/me/avatar", { method: "DELETE" })
      if (!res.ok) {
        toast({ title: "Failed to remove picture", variant: "destructive" })
        return
      }
      setPreviewImage(null)
      if (profile) setProfile({ ...profile, image: null })
      toast({ title: "Profile picture removed — refresh to see it in the header" })
    } finally {
      setUploading(false)
    }
  }

  const handleChangePassword = async () => {
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "New passwords do not match", variant: "destructive" })
      return
    }
    if (pwForm.next.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" })
      return
    }
    setPwSubmitting(true)
    const result = await authClient.changePassword({
      currentPassword: pwForm.current,
      newPassword: pwForm.next,
      revokeOtherSessions: true,
    })
    setPwSubmitting(false)
    if (result.error) {
      toast({
        title: "Could not change password",
        description: result.error.message ?? undefined,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Password changed successfully" })
    setPwOpen(false)
    setPwForm(emptyPwForm)
  }

  const initials = profile ? getInitials(profile.firstName, profile.lastName) : ""

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {previewImage && (
                      <AvatarImage
                        src={previewImage}
                        alt={`${profile.firstName} ${profile.lastName}`}
                      />
                    )}
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {previewImage ? "Change" : "Upload"} Photo
                  </Button>
                  {previewImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={uploading}
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">First Name</Label>
                  <p className="text-sm font-medium">{profile.firstName}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Last Name</Label>
                  <p className="text-sm font-medium">{profile.lastName}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p className="text-sm font-medium">{profile.email}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Role</Label>
                <p className="text-sm font-medium">{getRoleLabel(profile.role)}</p>
              </div>

              {/* Editable phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(555) 123-4567"
                  value={formatPhone(phone)}
                  onChange={handlePhoneInput}
                  maxLength={14}
                />
                <p className="text-xs text-muted-foreground">US numbers only (10 digits)</p>
              </div>

              <Button onClick={handleSavePhone} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>

              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setPwOpen(true)}
              >
                <KeyRound className="h-4 w-4" />
                Change Password
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Change password sub-dialog */}
      <Dialog
        open={pwOpen}
        onOpenChange={(v) => {
          if (!v) setPwForm(emptyPwForm)
          setPwOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input
                id="pw-new"
                type="password"
                placeholder="Min 8 characters"
                value={pwForm.next}
                onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type="password"
                placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPwForm(emptyPwForm)
                setPwOpen(false)
              }}
              disabled={pwSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={pwSubmitting || !pwForm.current || !pwForm.next || !pwForm.confirm}
            >
              {pwSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
