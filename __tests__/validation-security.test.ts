import { describe, expect, it } from "@jest/globals";
import { resetRateLimitForTests, isRateLimited } from "@/lib/rate-limit";
import { csvCell, parseButtonConfigInput, parseConversionInput } from "@/lib/validation";
import { isOriginAllowed, parseAllowedOrigins } from "@/lib/security";

describe("validation and security helpers", () => {
  it("normalizes conversion input and rejects malformed required fields", () => {
    const valid = parseConversionInput({
      accountId: " acc_1 ",
      name: " Maria ",
      email: "maria@example.com",
      phone: "+55 (11) 99999-9999",
      gclid: "",
      utm_campaign: " summer ",
    });

    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.accountId).toBe("acc_1");
      expect(valid.data.phone).toBe("5511999999999");
      expect(valid.data.gclid).toBeNull();
      expect(valid.data.utm_campaign).toBe("summer");
    }

    expect(parseConversionInput({ email: "not-an-email" }).ok).toBe(false);
    expect(parseConversionInput({ accountId: "a", name: "n", email: "bad", phone: "123" }).ok).toBe(false);
  });

  it("rejects unsafe widget configuration values", () => {
    expect(parseButtonConfigInput({
      position: "RIGHT",
      size: "LARGE",
      primaryColor: "javascript:alert(1)",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "*",
      gclidExpirationDays: 30,
      conversionName: "Lead",
      gaEventName: "whatsapp_form_submit",
    }).ok).toBe(false);

    expect(parseButtonConfigInput({
      position: "LEFT",
      size: "SMALL",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "https://example.com/path",
      gclidExpirationDays: 30,
      conversionName: "Lead",
      gaEventName: "whatsapp_form_submit",
    }).ok).toBe(false);

    expect(parseButtonConfigInput({
      position: "RIGHT",
      size: "LARGE",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "*",
      gclidExpirationDays: 30,
      conversionName: "Lead",
      gaEventName: "bad event name",
    }).ok).toBe(false);

    const parsed = parseButtonConfigInput({
      position: "LEFT",
      size: "SMALL",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "https://example.com, https://shop.example.com",
      gclidExpirationDays: "365",
      conversionName: "Lead",
      gaEventName: "whatsapp_form_submit",
    });

    expect(parsed.ok).toBe(true);
  });

  it("parses origin allow-lists exactly", () => {
    expect(parseAllowedOrigins("*")).toEqual(["*"]);
    expect(isOriginAllowed("https://example.com", "https://example.com")).toBe(true);
    expect(isOriginAllowed("https://evil.example", "https://example.com")).toBe(false);
    expect(isOriginAllowed(null, "https://example.com")).toBe(false);
  });

  it("escapes CSV cells with quotes and line breaks", () => {
    expect(csvCell('A "quoted"\nvalue')).toBe('"A ""quoted"" value"');
  });

  it("rate-limits only after the configured quota and resets by key", () => {
    resetRateLimitForTests();

    expect(isRateLimited("ip:a", { limit: 2, windowMs: 1000 }, 1000)).toBe(false);
    expect(isRateLimited("ip:a", { limit: 2, windowMs: 1000 }, 1001)).toBe(false);
    expect(isRateLimited("ip:a", { limit: 2, windowMs: 1000 }, 1002)).toBe(true);
    expect(isRateLimited("ip:b", { limit: 2, windowMs: 1000 }, 1002)).toBe(false);
    expect(isRateLimited("ip:a", { limit: 2, windowMs: 1000 }, 3000)).toBe(false);
  });
});
