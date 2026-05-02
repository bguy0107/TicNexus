import { auth } from "./auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

type FullSession = typeof auth.$Infer.Session

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
  if (!roles.includes(session.user.role as Role)) redirect("/")
  return session
}
