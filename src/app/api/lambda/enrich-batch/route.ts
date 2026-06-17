import { after } from "next/server"
import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enrichLeadFromGclid } from "@/lib/google-ads"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

export async function POST(request: Request) {
  const secret = process.env.API_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Batch enrichment not configured" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const secretBuf = Buffer.from(secret, "utf8")
  const tokenBuf = Buffer.from(token, "utf8")
  if (
    secretBuf.length !== tokenBuf.length ||
    !timingSafeEqual(secretBuf, tokenBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  const dayStart = new Date(date + "T00:00:00Z")
  const dayEnd = new Date(date + "T00:00:00Z")
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const leads = await prisma.customer.findMany({
    where: {
      gclid: { not: null },
      OR: [
        { enrichment_status: { not: "ENRICHED" } },
        { enrichment_status: null },
      ],
      conversionTime: { gte: dayStart, lt: dayEnd },
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
