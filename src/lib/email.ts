import nodemailer from "nodemailer"

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

  await transporter.sendMail({
    from: `TicNexus <${process.env.GMAIL_USER}>`,
    to,
    subject: "You have been invited to TicNexus",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0f172a;">Welcome to TicNexus</h2>
        <p>${inviterName} has invited you to join TicNexus as a <strong>${roleLabel}</strong>.</p>
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
