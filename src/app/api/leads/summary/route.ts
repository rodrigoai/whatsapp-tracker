import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/api-auth"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

type SummaryRow = {
  source: string
  campaignId: string | null
  campaign: string
  leads: bigint
  proposals: bigint
  sales: bigint
}

export async function GET(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("accountId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!accountId || !from || !to) {
    return NextResponse.json(
      { error: "accountId, from, and to are required" },
      { status: 400 }
    )
  }

  if (!isValidDate(from)) {
    return NextResponse.json({ error: "Invalid date format for 'from' (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!isValidDate(to)) {
    return NextResponse.json({ error: "Invalid date format for 'to' (YYYY-MM-DD)" }, { status: 400 })
  }

  const fromDate = new Date(from + "T00:00:00.000Z")
  const toDate = new Date(to + "T23:59:59.999Z")

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      CASE WHEN gclid IS NOT NULL THEN 'Google' ELSE 'Organic' END AS source,
      campaign_id                                                    AS "campaignId",
      COALESCE(campaign_name, utm_campaign, '(sem campanha)')        AS campaign,
      COUNT(*)                                                       AS leads,
      SUM(CASE WHEN status = 'Proposta' THEN 1 ELSE 0 END)          AS proposals,
      SUM(CASE WHEN status = 'Venda'    THEN 1 ELSE 0 END)          AS sales
    FROM "Customer"
    WHERE "accountId" = ${accountId}
      AND "conversionTime" >= ${fromDate}
      AND "conversionTime" <= ${toDate}
    GROUP BY source, "campaignId", campaign
    ORDER BY source ASC, campaign ASC
  `

  const groups = rows.map((row) => ({
    source: row.source,
    campaignId: row.campaignId ?? null,
    campaign: row.campaign,
    leads: Number(row.leads),
    proposals: Number(row.proposals),
    sales: Number(row.sales),
  }))

  return NextResponse.json({ groups })
}
