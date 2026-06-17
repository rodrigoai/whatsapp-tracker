import { after } from "next/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enrichLeadFromGclid } from "@/lib/google-ads"
import { checkAuth } from "@/lib/api-auth"
import { isValidDate, parseDayRangeUTC } from "@/lib/date-utils"

export async function POST(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 })
  }

  const date = (body as Record<string, unknown>)?.date
  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 })
  }

  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  const leads = await prisma.customer.findMany({
    where: {
      gclid: { not: null },
      OR: [
        { enrichment_status: { not: "ENRICHED" } },
        { enrichment_status: null },
      ],
      conversionTime: parseDayRangeUTC(date),
    },
    select: { id: true, gclid: true, accountId: true },
  })

  if (leads.length === 0) {
    return NextResponse.json({ queued: 0 }, { status: 202 })
  }

  after(async () => {
    for (const lead of leads) {
      await enrichLeadFromGclid(lead.id, lead.gclid!, lead.accountId)
    }
  })

  return NextResponse.json({ queued: leads.length }, { status: 202 })
}
