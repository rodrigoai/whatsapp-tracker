import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { getServerSession } = require("next-auth/next") as typeof import("next-auth/next");
const { GET } = require("@/app/api/admin/leads/route") as typeof import("@/app/api/admin/leads/route");

describe("Admin leads API", () => {
  const mockGetServerSession = getServerSession as unknown as jest.MockedFunction<() => Promise<unknown>>;
  const mockFindMany = prisma.customer.findMany as unknown as jest.MockedFunction<
    (args: unknown) => Promise<unknown[]>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { name: "Admin" } });
  });

  it("filters an inclusive seven-day period and returns lead-source totals", async () => {
    mockFindMany.mockResolvedValue([
      { id: "lead_1", gclid: "campaign-click" },
      { id: "lead_2", gclid: null },
      { id: "lead_3", gclid: null },
    ]);

    const response = await GET(
      new Request("https://tracker.test/api/admin/leads?accountId=acc_1&start=2026-06-01&end=2026-06-07")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        accountId: "acc_1",
        conversionTime: {
          gte: new Date("2026-06-01T00:00:00.000Z"),
          lte: new Date("2026-06-07T23:59:59.999Z"),
        },
      },
      orderBy: { conversionTime: "desc" },
    });
    expect(json.summary).toEqual({
      total: 3,
      campaign: 1,
      organic: 2,
    });
  });

  it("rejects periods longer than seven calendar days", async () => {
    const response = await GET(
      new Request("https://tracker.test/api/admin/leads?accountId=acc_1&start=2026-06-01&end=2026-06-08")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("O período máximo permitido é de 7 dias");
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("rejects incomplete or reversed periods", async () => {
    const incomplete = await GET(
      new Request("https://tracker.test/api/admin/leads?accountId=acc_1&start=2026-06-01")
    );
    const reversed = await GET(
      new Request("https://tracker.test/api/admin/leads?accountId=acc_1&start=2026-06-07&end=2026-06-01")
    );

    expect(incomplete.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
