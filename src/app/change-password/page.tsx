import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ChangePasswordForm } from "./change-password-form"

// [L3] Server-side guard: only users who must change their password land here
export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!session.user.mustChangePassword) redirect("/dashboard")
  return <ChangePasswordForm />
}
