import { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE = "better-auth.session_token"

const PUBLIC_ROUTES = new Set(["/login", "/reset-password"])
const PUBLIC_PREFIXES = ["/invite/", "/api/auth", "/api/invitations/"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  const isPublic =
    PUBLIC_ROUTES.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!sessionToken && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
