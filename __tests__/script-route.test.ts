import { describe, expect, it, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    buttonConfig: {
      findUnique: jest.fn(),
    },
  },
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { GET } = require("@/app/api/script.js/route") as typeof import("@/app/api/script.js/route");
const mockFindUnique = prisma.buttonConfig.findUnique as unknown as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>;

describe("tracking script route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("serializes config as data and writes button text via textContent", async () => {
    mockFindUnique.mockResolvedValue({
      id: "cfg_1",
      accountId: "acc_1",
      position: "RIGHT",
      size: "LARGE",
      primaryColor: "#25D366",
      buttonText: `Chat "; window.__owned = true; // <img src=x>`,
      balloonText: `Olá! "texto" <script>alert(1)</script>`,
      allowedOrigins: "https://example.com",
      gclidExpirationDays: 30,
      conversionName: "WhatsApp Lead",
      gaEventName: "whatsapp_form_submit",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await GET(new Request("https://tracker.test/api/script.js?accountId=acc_1"));
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain("const CONFIG = ");
    expect(script).toContain("buttonText.textContent = CONFIG.text");
    expect(script).toContain("modal.querySelector('#wa-tracking-message').textContent = CONFIG.balloonText");
    expect(script).not.toContain("${CONFIG.text}");
    expect(script).not.toContain("wa-tracking-skip");
    expect(script).not.toContain("Anonymous");
    expect(script).toContain('autocomplete="name"');
    expect(script).toContain('autocomplete="email"');
    expect(script).toContain('autocomplete="tel-national"');
    expect(script).toContain("form.reportValidity()");
    expect(script).toContain("phoneInput.addEventListener('input'");
    expect(script).toContain('"gaEventName":"whatsapp_form_submit"');
    expect(script).toContain("window.gtag('event', CONFIG.gaEventName");
    expect(script).toContain("window.dataLayer.push");
    expect(script).toContain("event_callback: finish");
    expect(script).toContain("transport_type: 'beacon'");
    expect(script).toContain("trackGoogleAnalyticsEvent(data");
    expect(script).toContain("/api/conversion?accountId=");
    expect(script).toContain('\\"; window.__owned = true;');
    expect(script).toContain('\\"texto\\"');
  });

  it("returns a JavaScript error for unknown account configs", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(new Request("https://tracker.test/api/script.js?accountId=missing"));

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Account config not found");
  });
});
