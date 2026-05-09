import nodemailer from "nodemailer"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendInvitationEmail({
  to,
  inviterName,
  role,
  inviteUrl,
}: {
  to: string
  inviterName: string
  role: string
  inviteUrl: string
}) {
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  const safeInviterName = escapeHtml(inviterName)

  await transporter.sendMail({
    from: `TicNexus <${process.env.GMAIL_USER}>`,
    to,
    subject: "You have been invited to TicNexus",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0f172a;">Welcome to TicNexus</h2>
        <p>${safeInviterName} has invited you to join TicNexus as a <strong>${roleLabel}</strong>.</p>
        <p>Click the button below to accept your invitation and set your password:</p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;font-weight:600;">
          Accept Invitation
        </a>
        <p style="color:#64748b;font-size:14px;">This link expires in 48 hours.</p>
        <p style="color:#64748b;font-size:14px;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  await transporter.sendMail({
    from: `TicNexus <${process.env.GMAIL_USER}>`,
    to,
    subject: "Password Reset - TicNexus",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0f172a;">Password Reset</h2>
        <p>A password reset has been requested for your TicNexus account.</p>
        <p>Click the button below to set a new password:</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:14px;">This link expires in 1 hour.</p>
        <p style="color:#64748b;font-size:14px;">
          If you did not request this, please contact your administrator immediately.
        </p>
      </div>
    `,
  })
}
