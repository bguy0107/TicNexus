import { auth } from "./auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

// better-auth's $Infer.Session.user omits additionalFields at the TS level,
// so we extend it manually to include the fields defined in auth.ts.
type FullUser = typeof auth.$Infer.Session.user & {
  role: Role
  firstName: string
  lastName: string
  deletedAt?: Date | null
  createdById?: string | null
}

export type FullSession = {
  session: (typeof auth.$Infer.Session)["session"]
  user: FullUser
}

export async function getApiSession(reqHeaders: Headers): Promise<FullSession | null> {
  return auth.api.getSession({ headers: reqHeaders }) as Promise<FullSession | null>
}

export async function getSession(): Promise<FullSession | null> {
  return auth.api.getSession({ headers: await headers() }) as Promise<FullSession | null>
}

export async function requireAuth(): Promise<FullSession> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

export async function requireRole(roles: Role[]): Promise<FullSession> {
  const session = await requireAuth()
  if (!roles.includes(session.user.role)) redirect("/")
  return session
}
