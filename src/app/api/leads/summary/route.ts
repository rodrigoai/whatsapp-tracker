import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/api-auth"
import { isValidDate, parseDateRangeUTC } from "@/lib/date-utils"

type SummaryRow = {
  source: string
  campaign_id: string | null
  campaign: string
  leads: bigint
  proposals: bigint
  sales: bigint
}

export async function GET(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("account_id")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!accountId || !from || !to) {
    return NextResponse.json(
      { error: "account_id, from, and to are required" },
      { status: 400 }
    )
  }

  if (!isValidDate(from)) {
    return NextResponse.json({ error: "Invalid date format for 'from' (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!isValidDate(to)) {
    return NextResponse.json({ error: "Invalid date format for 'to' (YYYY-MM-DD)" }, { status: 400 })
  }

  const { gte: fromDate, lte: toDate } = parseDateRangeUTC(from, to)

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      CASE WHEN gclid IS NOT NULL THEN 'Google' ELSE 'Organic' END AS source,
      campaign_id                                                    AS "campaign_id",
      COALESCE(campaign_name, utm_campaign, '(sem campanha)')        AS campaign,
      COUNT(*)                                                       AS leads,
      SUM(CASE WHEN status @> ARRAY['Proposta'] THEN 1 ELSE 0 END)  AS proposals,
      SUM(CASE WHEN status @> ARRAY['Venda']    THEN 1 ELSE 0 END)  AS sales
    FROM "Customer"
    WHERE "accountId" = ${accountId}
      AND "conversionTime" >= ${fromDate}
      AND "conversionTime" <= ${toDate}
    GROUP BY source, campaign_id, campaign
    ORDER BY source ASC, campaign ASC
  `

  const groups = rows.map((row) => ({
    source: row.source,
    campaign_id: row.campaign_id ?? null,
    campaign: row.campaign,
    leads: Number(row.leads),
    proposals: Number(row.proposals),
    sales: Number(row.sales),
  }))

  return NextResponse.json({ groups })
}
