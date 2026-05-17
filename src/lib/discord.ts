const WEBHOOK_URLS: Record<"IT" | "MAINTENANCE", string | undefined> = {
  IT: process.env.DISCORD_WEBHOOK_IT,
  MAINTENANCE: process.env.DISCORD_WEBHOOK_MAINTENANCE,
}

const DEPARTMENT_COLORS = {
  IT: 0x3b82f6, // blue
  MAINTENANCE: 0xf59e0b, // amber
}

export async function notifyFootageRequestCreated({
  requestId,
  locationName,
  createdByName,
  requestingParty,
  cameraArea,
  officerContact,
  sendTo,
  lookingFor,
}: {
  requestId: string
  locationName: string
  createdByName: string
  requestingParty: "LAW_ENFORCEMENT" | "INTERNAL"
  cameraArea: string
  officerContact?: string
  sendTo?: string
  lookingFor?: string
}) {
  const url = WEBHOOK_URLS["IT"]
  if (!url) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const requestUrl = `${appUrl}/dashboard/footage-requests/${requestId}`
  const partyLabel = requestingParty === "LAW_ENFORCEMENT" ? "Law Enforcement" : "Internal"

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Location", value: locationName, inline: true },
    { name: "Opened by", value: createdByName, inline: true },
    { name: "Requesting Party", value: partyLabel, inline: true },
    { name: "Camera Area", value: cameraArea.slice(0, 1024) },
  ]

  if (officerContact) fields.push({ name: "Officer contact", value: officerContact.slice(0, 1024) })
  if (sendTo) fields.push({ name: "Send to", value: sendTo.slice(0, 1024) })
  if (lookingFor) fields.push({ name: "What to look for", value: lookingFor.slice(0, 1024) })

  const payload: Record<string, unknown> = {
    ...(process.env.DISCORD_ROLE_IT && { content: `<@&${process.env.DISCORD_ROLE_IT}>` }),
    embeds: [
      {
        title: "New Footage Request Opened",
        url: requestUrl,
        color: DEPARTMENT_COLORS["IT"],
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-critical — never let a webhook failure break footage request creation
  }
}

export async function notifyTicketCreated({
  type,
  ticketId,
  issue,
  locationName,
  createdByName,
}: {
  type: "IT" | "MAINTENANCE"
  ticketId: string
  issue: string
  locationName: string
  createdByName: string
}) {
  const url = WEBHOOK_URLS[type]
  if (!url) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const ticketUrl = `${appUrl}/dashboard/tickets/${ticketId}`
  const label = type === "IT" ? "IT" : "Maintenance"

  const payload: Record<string, unknown> = {
    ...(type === "IT" &&
      process.env.DISCORD_ROLE_IT && { content: `<@&${process.env.DISCORD_ROLE_IT}>` }),
    ...(type === "MAINTENANCE" &&
      process.env.DISCORD_ROLE_MAINTENANCE && {
        content: `<@&${process.env.DISCORD_ROLE_MAINTENANCE}>`,
      }),
    embeds: [
      {
        title: `New ${label} Ticket Opened`,
        url: ticketUrl,
        color: DEPARTMENT_COLORS[type],
        fields: [
          { name: "Location", value: locationName, inline: true },
          { name: "Opened by", value: createdByName, inline: true },
          { name: "Issue", value: issue.slice(0, 1024) },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-critical — never let a webhook failure break ticket creation
  }
}
