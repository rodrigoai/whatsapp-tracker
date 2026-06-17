import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
    },
  },
}))

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma")
const { GET } = require("@/app/api/leads/route") as typeof import("@/app/api/leads/route")

const SECRET = "test-secret-abc"
const BASE_URL = "https://tracker.test/api/leads"

function req(params: Record<string, string | string[]> = {}, headers: Record<string, string> = {}) {
  const url = new URL(BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach((val) => url.searchParams.append(k, val))
    } else {
      url.searchParams.set(k, v)
    }
  }
  return new Request(url.toString(), {
    headers: { authorization: `Bearer ${SECRET}`, ...headers },
  })
}

const mockFindMany = () =>
  (prisma.customer.findMany as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown[]>>)

const SAMPLE_LEAD = {
  id: "lead_1",
  name: "Ana",
  email: "ana@test.com",
  phone: "11999990000",
  status: null,
  conversionTime: new Date("2025-06-01T12:00:00.000Z"),
  conversionName: "WhatsApp Conversion",
  value: 0,
  currency: "BRL",
  utm_source: null,
  utm_campaign: null,
  utm_medium: null,
  gclid: "abc123",
  gbraid: null,
  wbraid: null,
  enrichment_status: null,
  campaign_id: null,
  campaign_name: null,
  ad_group_id: null,
  ad_group_name: null,
  gclid_keyword: null,
  gclid_match_type: null,
  gclid_ad_id: null,
  gclid_click_date: null,
  gclid_ad_network_type: null,
  gclid_page_number: null,
  gclid_geo_interest_country: null,
  gclid_geo_interest_region: null,
  gclid_geo_presence_country: null,
  gclid_geo_presence_region: null,
}

describe("GET /api/leads", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_SECRET = SECRET
    mockFindMany().mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.API_SECRET
  })

  // 7.1
  describe("auth", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await GET(new Request(`${BASE_URL}?account_id=acc1`))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 401 when token is invalid", async () => {
      const res = await GET(req({ account_id: "acc1" }, { authorization: "Bearer wrong" }))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
  })

  // 7.2
  it("returns 503 when API_SECRET is not set", async () => {
    delete process.env.API_SECRET
    const res = await GET(req({ account_id: "acc1" }))
    expect(res.status).toBe(503)
  })

  // 7.3
  it("returns 400 when account_id is missing", async () => {
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("account_id") })
  })

  // 7.4
  describe("date filter validation", () => {
    it("returns 400 when only from is provided", async () => {
      const res = await GET(req({ account_id: "acc1", from: "2025-01-01" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/from.*to|to.*from|Both/i)
    })

    it("returns 400 when only to is provided", async () => {
      const res = await GET(req({ account_id: "acc1", to: "2025-01-31" }))
      expect(res.status).toBe(400)
    })

    it("returns 400 when from has invalid date format", async () => {
      const res = await GET(req({ account_id: "acc1", from: "01-2025-01", to: "2025-01-31" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/from/i)
    })

    it("returns 400 when to has invalid date format", async () => {
      const res = await GET(req({ account_id: "acc1", from: "2025-01-01", to: "not-a-date" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/to/i)
    })

    it("passes UTC day boundaries to Prisma (no timezone conversion)", async () => {
      await GET(req({ account_id: "acc1", from: "2025-01-01", to: "2025-01-31" }))
      expect(mockFindMany()).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversionTime: {
              gte: new Date("2025-01-01T00:00:00.000Z"),
              lte: new Date("2025-01-31T23:59:59.999Z"),
            },
          }),
        })
      )
    })
  })

  // 7.5
  it("returns 400 when unknown status value provided", async () => {
    const res = await GET(req({ account_id: "acc1", status: "Unknown" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Unknown/)
  })

  // 7.6
  describe("pagination validation", () => {
    it("returns 400 when page_size exceeds 200", async () => {
      const res = await GET(req({ account_id: "acc1", page_size: "201" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/200/)
    })

    it("returns 400 when cursor is malformed", async () => {
      const res = await GET(req({ account_id: "acc1", cursor: "not-valid-base64!!!" }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: "Invalid cursor" })
    })
  })

  // 7.7
  it("returns first page of leads in reverse-chronological order", async () => {
    mockFindMany().mockResolvedValue([SAMPLE_LEAD])

    const res = await GET(req({ account_id: "acc1" }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("lead_1")
    expect(body.pagination.has_more).toBe(false)
    expect(body.pagination.next_cursor).toBeNull()
    expect(body.pagination.page_size).toBe(50)

    // response uses snake_case for renamed fields
    expect(body.data[0]).toHaveProperty("conversion_time")
    expect(body.data[0]).toHaveProperty("conversion_name")
    expect(body.data[0]).not.toHaveProperty("conversionTime")
    expect(body.data[0]).not.toHaveProperty("conversionName")

    // google_ads nested, click IDs not at top level
    expect(body.data[0]).toHaveProperty("google_ads")
    expect(body.data[0]).not.toHaveProperty("gclid")
    expect(body.data[0].google_ads.gclid).toBe("abc123")

    expect(mockFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc1" }),
        orderBy: [{ conversionTime: "desc" }, { id: "desc" }],
        take: 51,
      })
    )
  })

  // 7.8
  it("returns second page via cursor", async () => {
    const lead2 = { ...SAMPLE_LEAD, id: "lead_2", conversionTime: new Date("2025-05-30T10:00:00.000Z") }
    // First page: page_size=1 → fetch 2 rows, return 1, encode cursor
    mockFindMany().mockResolvedValueOnce([SAMPLE_LEAD, lead2])

    const page1 = await GET(req({ account_id: "acc1", page_size: "1" }))
    const body1 = await page1.json()
    expect(body1.pagination.has_more).toBe(true)
    expect(body1.pagination.next_cursor).not.toBeNull()

    // Second page
    mockFindMany().mockResolvedValueOnce([lead2])
    const page2 = await GET(req({ account_id: "acc1", page_size: "1", cursor: body1.pagination.next_cursor }))
    expect(page2.status).toBe(200)
    const body2 = await page2.json()
    expect(body2.data[0].id).toBe("lead_2")
    expect(body2.pagination.has_more).toBe(false)
  })

  // 7.9
  it("maps Not Qualified status to { status: null } inside AND clause", async () => {
    await GET(req({ account_id: "acc1", status: "Not Qualified" }))

    expect(mockFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ OR: [{ status: null }] }]),
        }),
      })
    )
  })

  it("combines multiple status values with OR inside AND clause", async () => {
    await GET(req({ account_id: "acc1", status: ["Proposta", "Venda"] }))

    expect(mockFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ status: "Proposta" }, { status: "Venda" }] },
          ]),
        }),
      })
    )
  })

  // 7.10
  it("nests google_ads fields, excludes enrichment_error, keeps utm at top level", async () => {
    mockFindMany().mockResolvedValue([SAMPLE_LEAD])

    const res = await GET(req({ account_id: "acc1" }))
    const body = await res.json()
    const lead = body.data[0]

    // enrichment_status top-level (provider-agnostic)
    expect(lead).toHaveProperty("enrichment_status")

    // google_ads nested object present without enrichment_status
    expect(lead).toHaveProperty("google_ads")
    expect(lead.google_ads).not.toHaveProperty("enrichment_status")
    expect(lead.google_ads).toHaveProperty("campaign_id")
    expect(lead.google_ads).toHaveProperty("gclid_keyword")
    expect(lead.google_ads).toHaveProperty("gclid")
    expect(lead.google_ads).toHaveProperty("gbraid")
    expect(lead.google_ads).toHaveProperty("wbraid")

    // click IDs not at top level
    expect(lead).not.toHaveProperty("gclid")
    expect(lead).not.toHaveProperty("gbraid")
    expect(lead).not.toHaveProperty("wbraid")

    // enrichment_error absent everywhere
    expect(lead).not.toHaveProperty("enrichment_error")
    expect(lead.google_ads).not.toHaveProperty("enrichment_error")

    // utm stays top-level
    expect(lead).toHaveProperty("utm_source")
    expect(lead).toHaveProperty("utm_campaign")
    expect(lead).toHaveProperty("utm_medium")

    // Prisma select includes all needed fields
    const callArgs = mockFindMany().mock.calls[0] as [{ select: Record<string, boolean> }]
    expect(callArgs[0].select).not.toHaveProperty("enrichment_error")
    expect(callArgs[0].select.gclid).toBe(true)
    expect(callArgs[0].select.enrichment_status).toBe(true)
  })
})
