const WEBHOOK_URLS: Record<"IT" | "MAINTENANCE", string | undefined> = {
  IT: process.env.DISCORD_WEBHOOK_IT,
  MAINTENANCE: process.env.DISCORD_WEBHOOK_MAINTENANCE,
}

const DEPARTMENT_COLORS = {
  IT: 0x3b82f6, // blue
  MAINTENANCE: 0xf59e0b, // amber
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

  const payload = {
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
