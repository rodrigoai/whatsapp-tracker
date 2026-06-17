import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/api-auth"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

const VALID_STATUSES = ["Not Qualified", "Proposta", "Venda"] as const
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const LEAD_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  conversionTime: true,
  conversionName: true,
  value: true,
  currency: true,
  gclid: true,
  gbraid: true,
  wbraid: true,
  utm_source: true,
  utm_campaign: true,
  utm_medium: true,
  enrichment_status: true,
  campaign_id: true,
  campaign_name: true,
  ad_group_id: true,
  ad_group_name: true,
  gclid_keyword: true,
  gclid_match_type: true,
  gclid_ad_id: true,
  gclid_click_date: true,
  gclid_ad_network_type: true,
  gclid_page_number: true,
  gclid_geo_interest_country: true,
  gclid_geo_interest_region: true,
  gclid_geo_presence_country: true,
  gclid_geo_presence_region: true,
} as const

type Cursor = { conversionTime: string; id: string }

function encodeCursor(conversionTime: Date, id: string): string {
  return Buffer.from(JSON.stringify({ conversionTime: conversionTime.toISOString(), id })).toString("base64url")
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).conversionTime === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      return parsed as Cursor
    }
    return null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("account_id")
  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 })
  }

  // pageSize validation
  const pageSizeRaw = searchParams.get("page_size")
  const pageSize = pageSizeRaw !== null ? parseInt(pageSizeRaw, 10) : DEFAULT_PAGE_SIZE
  if (isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return NextResponse.json({ error: "pageSize must be between 1 and 200" }, { status: 400 })
  }

  // cursor
  const cursorRaw = searchParams.get("cursor")
  let cursor: Cursor | null = null
  if (cursorRaw) {
    cursor = decodeCursor(cursorRaw)
    if (!cursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
    }
  }

  // date filter
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  let conversionTime: { gte: Date; lte: Date } | undefined
  if (from !== null || to !== null) {
    if (!from || !to) {
      return NextResponse.json(
        { error: "Both from and to are required when filtering by date" },
        { status: 400 }
      )
    }
    if (!isValidDate(from)) {
      return NextResponse.json({ error: "Invalid date format for 'from' (use YYYY-MM-DD)" }, { status: 400 })
    }
    if (!isValidDate(to)) {
      return NextResponse.json({ error: "Invalid date format for 'to' (use YYYY-MM-DD)" }, { status: 400 })
    }
    conversionTime = {
      gte: new Date(from + "T00:00:00.000Z"),
      lte: new Date(to + "T23:59:59.999Z"),
    }
  }

  // status filter
  const statusParams = searchParams.getAll("status")
  let statusFilter: { OR: ({ status: null } | { status: string })[] } | undefined
  if (statusParams.length > 0) {
    for (const s of statusParams) {
      if (!(VALID_STATUSES as readonly string[]).includes(s)) {
        return NextResponse.json({ error: `Invalid status value: ${s}` }, { status: 400 })
      }
    }
    statusFilter = {
      OR: statusParams.map((s) =>
        s === "Not Qualified" ? { status: null } : { status: s }
      ),
    }
  }

  // cursor where clause
  const cursorWhere = cursor
    ? {
        OR: [
          { conversionTime: { lt: new Date(cursor.conversionTime) } },
          { conversionTime: new Date(cursor.conversionTime), id: { lt: cursor.id } },
        ],
      }
    : undefined

  // statusFilter and cursorWhere both use OR — combine with AND to avoid key collision
  const andClauses = ([statusFilter, cursorWhere] as object[]).filter(Boolean)

  const rows = await prisma.customer.findMany({
    where: {
      accountId,
      ...(conversionTime ? { conversionTime } : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    },
    select: LEAD_FIELDS,
    orderBy: [{ conversionTime: "desc" }, { id: "desc" }],
    take: pageSize + 1,
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.conversionTime, last.id) : null

  const data = page.map(({ gclid, gbraid, wbraid, campaign_id, campaign_name,
    ad_group_id, ad_group_name, gclid_keyword, gclid_match_type, gclid_ad_id, gclid_click_date,
    gclid_ad_network_type, gclid_page_number, gclid_geo_interest_country, gclid_geo_interest_region,
    gclid_geo_presence_country, gclid_geo_presence_region,
    conversionTime, conversionName,
    ...core }) => ({
    ...core,
    conversion_time: conversionTime,
    conversion_name: conversionName,
    google_ads: {
      gclid, gbraid, wbraid, campaign_id, campaign_name,
      ad_group_id, ad_group_name, gclid_keyword, gclid_match_type, gclid_ad_id, gclid_click_date,
      gclid_ad_network_type, gclid_page_number, gclid_geo_interest_country, gclid_geo_interest_region,
      gclid_geo_presence_country, gclid_geo_presence_region,
    },
  }))

  return NextResponse.json({
    data,
    pagination: { next_cursor: nextCursor, has_more: hasMore, page_size: pageSize },
  })
}
