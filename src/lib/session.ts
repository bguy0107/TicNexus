import { auth } from "./auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Role, Department } from "@prisma/client"

// better-auth's $Infer.Session.user omits additionalFields at the TS level,
// so we extend it manually to include the fields defined in auth.ts.
type FullUser = typeof auth.$Infer.Session.user & {
  role: Role
  departments: Department[]
  firstName: string
  lastName: string
  image?: string | null
  deletedAt?: Date | null
  createdById?: string | null
  mustChangePassword?: boolean
}

export type FullSession = {
  session: (typeof auth.$Infer.Session)["session"]
  user: FullUser
}

export async function getApiSession(reqHeaders: Headers): Promise<FullSession | null> {
  const session = (await auth.api.getSession({ headers: reqHeaders })) as FullSession | null
  if (session?.user.deletedAt) return null
  return session
}

export async function getSession(): Promise<FullSession | null> {
  const session = (await auth.api.getSession({ headers: await headers() })) as FullSession | null
  if (session?.user.deletedAt) return null
  return session
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
