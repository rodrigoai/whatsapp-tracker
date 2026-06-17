import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("next/server", () => {
  const actual = jest.requireActual<typeof import("next/server")>("next/server");
  return { ...actual, after: jest.fn() };
});

jest.mock("@/lib/google-ads", () => ({
  enrichLeadFromGclid: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { after } = require("next/server") as typeof import("next/server");
const { enrichLeadFromGclid } = require("@/lib/google-ads") as typeof import("@/lib/google-ads");
const { POST } = require("@/app/api/lambda/enrich-batch/route") as typeof import("@/app/api/lambda/enrich-batch/route");

const SECRET = "test-lambda-secret-abc123";
const DATE = "2025-06-10";

function req(body: unknown = { date: DATE }, extraHeaders: Record<string, string> = {}) {
  return new Request("https://tracker.test/api/lambda/enrich-batch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/lambda/enrich-batch", () => {
  const mockFindMany = prisma.customer.findMany as unknown as jest.MockedFunction<
    (args: unknown) => Promise<unknown[]>
  >;
  const mockAfter = after as jest.MockedFunction<typeof after>;
  const mockEnrich = enrichLeadFromGclid as jest.MockedFunction<typeof enrichLeadFromGclid>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_SECRET = SECRET;
    mockFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.API_SECRET;
  });

  describe("auth guard", () => {
    it("returns 503 when API_SECRET env var is not set", async () => {
      delete process.env.API_SECRET;
      const res = await POST(req());
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "Not configured" });
    });

    it("returns 401 when Authorization header is absent", async () => {
      const res = await POST(
        new Request("https://tracker.test/api/lambda/enrich-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: DATE }),
        })
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when Authorization header is not Bearer scheme", async () => {
      const res = await POST(req({ date: DATE }, { authorization: `Basic ${SECRET}` }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when bearer token does not match secret", async () => {
      const res = await POST(req({ date: DATE }, { authorization: "Bearer wrong-token" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("does not enrich or query DB when auth fails", async () => {
      await POST(req({ date: DATE }, { authorization: "Bearer wrong-token" }));
      expect(mockFindMany).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });
  });

  describe("date validation", () => {
    it("returns 400 when date field is absent", async () => {
      const res = await POST(req({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "date is required (YYYY-MM-DD)" });
    });

    it("returns 400 when body is not JSON", async () => {
      const res = await POST(
        new Request("https://tracker.test/api/lambda/enrich-batch", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
          body: "not-json",
        })
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "date is required (YYYY-MM-DD)" });
    });

    it("returns 400 for non-string date value", async () => {
      const res = await POST(req({ date: 20250610 }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "date is required (YYYY-MM-DD)" });
    });

    it("returns 400 with 'Invalid date format' for free-text date", async () => {
      const res = await POST(req({ date: "today" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid date format" });
    });

    it("returns 400 with 'Invalid date format' for out-of-range date", async () => {
      const res = await POST(req({ date: "2025-13-01" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid date format" });
    });

    it("returns 400 with 'Invalid date format' for partial date string", async () => {
      const res = await POST(req({ date: "2025-06" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid date format" });
    });

    it("does not call findMany when date is invalid", async () => {
      await POST(req({ date: "bad" }));
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe("eligibility query", () => {
    it("queries leads with gclid set, status not ENRICHED, within UTC day bounds", async () => {
      await POST(req({ date: DATE }));
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          gclid: { not: null },
          OR: [
            { enrichment_status: { not: "ENRICHED" } },
            { enrichment_status: null },
          ],
          conversionTime: {
            gte: new Date("2025-06-10T00:00:00.000Z"),
            lt: new Date("2025-06-11T00:00:00.000Z"),
          },
        },
        select: { id: true, gclid: true, accountId: true },
      });
    });
  });

  describe("response behaviour", () => {
    it("returns 202 with queued:0 and does not register after() when no eligible leads", async () => {
      mockFindMany.mockResolvedValue([]);
      const res = await POST(req());
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ queued: 0 });
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("returns 202 immediately with queued count when eligible leads exist", async () => {
      mockFindMany.mockResolvedValue([
        { id: "c1", gclid: "g1", accountId: "a1" },
        { id: "c2", gclid: "g2", accountId: "a1" },
      ]);
      const res = await POST(req());
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ queued: 2 });
    });

    it("registers after() callback when eligible leads exist", async () => {
      mockFindMany.mockResolvedValue([{ id: "c1", gclid: "g1", accountId: "a1" }]);
      await POST(req());
      expect(mockAfter).toHaveBeenCalledTimes(1);
    });
  });

  describe("batch execution (after callback)", () => {
    async function runBatch(leads: { id: string; gclid: string; accountId: string }[]) {
      mockFindMany.mockResolvedValue(leads);
      let callback: (() => Promise<void>) | null = null;
      mockAfter.mockImplementation((fn) => {
        callback = fn as () => Promise<void>;
      });
      await POST(req());
      if (callback) await callback();
    }

    it("calls enrichLeadFromGclid for each eligible lead with correct args", async () => {
      await runBatch([
        { id: "c1", gclid: "g1", accountId: "a1" },
        { id: "c2", gclid: "g2", accountId: "a2" },
      ]);
      expect(mockEnrich).toHaveBeenCalledTimes(2);
      expect(mockEnrich).toHaveBeenNthCalledWith(1, "c1", "g1", "a1");
      expect(mockEnrich).toHaveBeenNthCalledWith(2, "c2", "g2", "a2");
    });

    it("calls enrichLeadFromGclid in registration order (sequential)", async () => {
      const order: string[] = [];
      mockEnrich.mockImplementation(async (id) => { order.push(id as string) });
      await runBatch([
        { id: "first", gclid: "g1", accountId: "a1" },
        { id: "second", gclid: "g2", accountId: "a1" },
        { id: "third", gclid: "g3", accountId: "a1" },
      ]);
      expect(order).toEqual(["first", "second", "third"]);
    });

    it("does not call enrichLeadFromGclid directly from the route — only inside after()", async () => {
      mockFindMany.mockResolvedValue([{ id: "c1", gclid: "g1", accountId: "a1" }]);
      // do NOT execute the after() callback
      mockAfter.mockImplementation(() => {});
      await POST(req());
      expect(mockEnrich).not.toHaveBeenCalled();
    });
  });
});
