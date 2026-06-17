import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}))

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma")
const { GET } = require("@/app/api/leads/summary/route") as typeof import("@/app/api/leads/summary/route")

const SECRET = "test-api-secret-xyz"
const BASE_URL = "https://tracker.test/api/leads/summary"

function req(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const url = new URL(BASE_URL)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString(), {
    headers: { authorization: `Bearer ${SECRET}`, ...headers },
  })
}

const VALID_PARAMS = { account_id: "acc1", from: "2025-01-01", to: "2025-01-31" }

describe("GET /api/leads/summary", () => {
  const mockQueryRaw = prisma.$queryRaw as jest.MockedFunction<typeof prisma.$queryRaw>

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_SECRET = SECRET
    mockQueryRaw.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.API_SECRET
  })

  describe("auth guard", () => {
    it("returns 503 when API_SECRET is not set", async () => {
      delete process.env.API_SECRET
      const res = await GET(req(VALID_PARAMS))
      expect(res.status).toBe(503)
    })

    it("returns 401 when Authorization header is missing", async () => {
      const res = await GET(new Request(`${BASE_URL}?account_id=acc1&from=2025-01-01&to=2025-01-31`))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 401 when token does not match API_SECRET", async () => {
      const res = await GET(req(VALID_PARAMS, { authorization: "Bearer wrong" }))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
  })

  describe("param validation", () => {
    it("returns 400 when account_id is missing", async () => {
      const res = await GET(req({ from: "2025-01-01", to: "2025-01-31" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/account_id/)
    })

    it("returns 400 when from is missing", async () => {
      const res = await GET(req({ accountId: "acc1", to: "2025-01-31" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/from/)
    })

    it("returns 400 when to is missing", async () => {
      const res = await GET(req({ accountId: "acc1", from: "2025-01-01" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/to/)
    })

    it("returns 400 for invalid from date format", async () => {
      const res = await GET(req({ ...VALID_PARAMS, from: "01-2025-01" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/from/)
    })

    it("returns 400 for invalid to date format", async () => {
      const res = await GET(req({ ...VALID_PARAMS, to: "not-a-date" }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/to/)
    })
  })

  describe("aggregation result", () => {
    it("passes correct UTC date bounds to $queryRaw", async () => {
      await GET(req({ account_id: "acc1", from: "2025-01-01", to: "2025-01-31" }))
      expect(mockQueryRaw).toHaveBeenCalledTimes(1)
      const callArgs = mockQueryRaw.mock.calls[0]
      const queryParts = callArgs[0] as unknown[]
      // Tagged template: args[0] is the TemplateStringsArray, rest are interpolated values
      // Values order: accountId, fromDate, toDate
      const interpolated = callArgs.slice(1) as unknown[]
      expect(interpolated[0]).toBe("acc1")
      expect(interpolated[1]).toEqual(new Date("2025-01-01T00:00:00.000Z"))
      expect(interpolated[2]).toEqual(new Date("2025-01-31T23:59:59.999Z"))
    })

    it("returns 200 with empty groups when no rows", async () => {
      mockQueryRaw.mockResolvedValue([])
      const res = await GET(req(VALID_PARAMS))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ groups: [] })
    })

    it("returns correct funnel counts and casts BigInt to Number", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          source: "Google",
          campaign_id: "123",
          campaign: "Campanha A",
          leads: BigInt(50),
          proposals: BigInt(10),
          sales: BigInt(3),
        },
        {
          source: "Organic",
          campaign_id: null,
          campaign: "(sem campanha)",
          leads: BigInt(12),
          proposals: BigInt(2),
          sales: BigInt(1),
        },
      ])

      const res = await GET(req(VALID_PARAMS))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        groups: [
          { source: "Google", campaign_id: "123", campaign: "Campanha A", leads: 50, proposals: 10, sales: 3 },
          { source: "Organic", campaign_id: null, campaign: "(sem campanha)", leads: 12, proposals: 2, sales: 1 },
        ],
      })
    })

    it("sets campaignId to null when absent in row", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          source: "Google",
          campaign_id: null,
          campaign: "(sem campanha)",
          leads: BigInt(5),
          proposals: BigInt(0),
          sales: BigInt(0),
        },
      ])

      const res = await GET(req(VALID_PARAMS))
      const body = await res.json()
      expect(body.groups[0].campaign_id).toBeNull()
    })
  })
})
