import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { resetRateLimitForTests } from "@/lib/rate-limit";


const tx = {
  account: {
    findUnique: jest.fn<() => Promise<unknown>>(),
    update: jest.fn<(args: unknown) => Promise<unknown>>(),
  },
  customer: {
    create: jest.fn<(args: unknown) => Promise<unknown>>(),
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    buttonConfig: {
      findUnique: jest.fn(),
    },
  },
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { OPTIONS, POST } = require("@/app/api/conversion/route") as typeof import("@/app/api/conversion/route");

function conversionRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://tracker.test/api/conversion?accountId=acc_1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.com",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("conversion route", () => {
  const mockTransaction = prisma.$transaction as unknown as jest.MockedFunction<
    (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
  >;
  const mockFindConfig = prisma.buttonConfig.findUnique as unknown as jest.MockedFunction<
    (args: unknown) => Promise<unknown>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitForTests();
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    tx.customer.create.mockResolvedValue({ id: "lead_1" });
    tx.account.findUnique.mockResolvedValue({
      id: "acc_1",
      name: "Store",
      nextAttendantIndex: 1,
      buttonConfig: {
        conversionName: "WhatsApp Lead",
        allowedOrigins: "https://example.com/",
        formFields: "name,email,phone",
      },
      attendants: [
        { id: "att_1", name: "Ana", phone: "11911111111" },
        { id: "att_2", name: "Bruno", phone: "11922222222" },
      ],
    });
  });

  it("creates a lead and advances the account cursor transactionally", async () => {
    const response = await POST(conversionRequest({
      accountId: "acc_1",
      name: "Lead",
      email: "lead@example.com",
      phone: "(11) 99999-9999",
      gclid: " click ",
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.attendantName).toBe("Bruno");
    expect(json.number).toBe("5511922222222");
    expect(json.mobileUrl).toBe("https://api.whatsapp.com/send?phone=5511922222222");
    expect(json.desktopUrl).toBe("https://api.whatsapp.com/send?phone=5511922222222");
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: { nextAttendantIndex: 0 },
    });
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acc_1",
        email: "lead@example.com",
        phone: "11999999999",
        conversionName: "WhatsApp Lead",
        enrichment_status: "PENDING",
      }),
    });
  });

  it("rejects origins outside the account allow-list before creating a lead", async () => {
    const response = await POST(conversionRequest({
      accountId: "acc_1",
      name: "Lead",
      email: "lead@example.com",
      phone: "11999999999",
    }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(tx.account.update).not.toHaveBeenCalled();
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it("rejects invalid conversion bodies", async () => {
    const response = await POST(conversionRequest({
      accountId: "acc_1",
      name: "Lead",
      email: "bad-email",
      phone: "123",
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it("accepts leads with only the configured fields", async () => {
    tx.account.findUnique.mockResolvedValue({
      id: "acc_1",
      name: "Store",
      nextAttendantIndex: 0,
      buttonConfig: {
        conversionName: "WhatsApp Lead",
        allowedOrigins: "https://example.com/",
        formFields: "phone",
      },
      attendants: [
        { id: "att_1", name: "Ana", phone: "11911111111" },
      ],
    });

    const response = await POST(conversionRequest({
      accountId: "acc_1",
      phone: "(11) 99999-9999",
    }));

    expect(response.status).toBe(200);
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acc_1",
        name: null,
        email: null,
        phone: "11999999999",
      }),
    });
  });

  it("rate-limits repeated conversion attempts by client address", async () => {
    const body = {
      accountId: "acc_1",
      name: "Lead",
      email: "lead@example.com",
      phone: "11999999999",
    };

    for (let i = 0; i < 30; i += 1) {
      await POST(conversionRequest(body));
    }

    const response = await POST(conversionRequest(body));
    expect(response.status).toBe(429);
  });

  it("uses account CORS rules for preflight requests", async () => {
    mockFindConfig.mockResolvedValue({
      id: "cfg_1",
      accountId: "acc_1",
      position: "RIGHT",
      size: "LARGE",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "https://example.com/",
      gclidExpirationDays: 30,
      conversionName: "WhatsApp Lead",
      gaEventName: "whatsapp_form_submit",
      formFields: "name,email,phone",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const allowed = await OPTIONS(new Request("https://tracker.test/api/conversion?accountId=acc_1", {
      method: "OPTIONS",
      headers: { origin: "https://example.com" },
    }));
    const denied = await OPTIONS(new Request("https://tracker.test/api/conversion?accountId=acc_1", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }));

    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(denied.status).toBe(403);
  });
});
