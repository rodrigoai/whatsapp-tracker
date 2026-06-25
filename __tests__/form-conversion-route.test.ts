import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { resetRateLimitForTests } from "@/lib/rate-limit";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: jest.fn(),
    },
    customer: {
      create: jest.fn(),
    },
    buttonConfig: {
      findUnique: jest.fn(),
    },
  },
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { OPTIONS, POST } = require("@/app/api/form-conversion/route") as typeof import("@/app/api/form-conversion/route");

function formConversionRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://tracker.test/api/form-conversion?accountId=acc_1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.com",
      "x-forwarded-for": "203.0.113.20",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("form conversion route", () => {
  const mockFindAccount = prisma.account.findUnique as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockCreateCustomer = prisma.customer.create as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockFindConfig = prisma.buttonConfig.findUnique as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitForTests();
    mockCreateCustomer.mockResolvedValue({ id: "lead_1" });
    mockFindAccount.mockResolvedValue({
      id: "acc_1",
      buttonConfig: { allowedOrigins: "https://example.com" },
      formTrackings: [
        { id: "form_1", name: "Main Form", selector: "#form-one", isActive: true },
      ],
    });
  });

  it("creates a lead for an active configured form without rotating attendants", async () => {
    const response = await POST(formConversionRequest({
      accountId: "acc_1",
      formTrackingId: "form_1",
      name: "Maria Souza",
      email: "maria@example.com",
      phone: "(11) 99999-9999",
      gclid: " click ",
      utm_source: "google",
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, leadId: "lead_1" });
    expect(mockCreateCustomer).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acc_1",
        name: "Maria Souza",
        email: "maria@example.com",
        phone: "11999999999",
        gclid: "click",
        utm_source: "google",
        conversionName: "Form: Main Form",
      }),
    });
  });

  it("rejects origins outside the shared allow-list", async () => {
    const response = await POST(formConversionRequest({
      accountId: "acc_1",
      formTrackingId: "form_1",
      email: "maria@example.com",
    }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it("requires at least one contact field", async () => {
    const response = await POST(formConversionRequest({
      accountId: "acc_1",
      formTrackingId: "form_1",
    }));

    expect(response.status).toBe(400);
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it("rejects unknown or inactive form tracking ids", async () => {
    const response = await POST(formConversionRequest({
      accountId: "acc_1",
      formTrackingId: "missing",
      email: "maria@example.com",
    }));

    expect(response.status).toBe(404);
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it("uses account CORS rules for preflight requests", async () => {
    mockFindConfig.mockResolvedValue({
      allowedOrigins: "https://example.com",
    });

    const allowed = await OPTIONS(new Request("https://tracker.test/api/form-conversion?accountId=acc_1", {
      method: "OPTIONS",
      headers: { origin: "https://example.com" },
    }));
    const denied = await OPTIONS(new Request("https://tracker.test/api/form-conversion?accountId=acc_1", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }));

    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(denied.status).toBe(403);
  });
});
