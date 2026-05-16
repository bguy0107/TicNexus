import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { db } from "./db"
import { sendPasswordResetEmail } from "./email"

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const isHttps = appUrl.startsWith("https://")

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, resetUrl: url })
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  trustedOrigins: [appUrl],
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      role: { type: "string", required: true, defaultValue: "STORE_USER" },
      deletedAt: { type: "date", required: false },
      createdById: { type: "string", required: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false },
      departments: { type: "string", required: false },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      secure: isHttps,
      httpOnly: true,
      sameSite: "lax",
    },
    useSecureCookies: isHttps,
  },
})

export type BetterAuthSession = typeof auth.$Infer.Session
export type BetterAuthUser = typeof auth.$Infer.Session.user
