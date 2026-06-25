import { describe, expect, it } from "@jest/globals";
import { resetRateLimitForTests, isRateLimited } from "@/lib/rate-limit";
import {
  csvCell,
  normalizeBrazilianPhoneForMatch,
  parseButtonConfigInput,
  parseConversionInput,
  parseFormConversionInput,
  parseFormFields,
  parseFormFieldsInput,
  parseFormTrackingInput,
} from "@/lib/validation";
import { isOriginAllowed, parseAllowedOrigins } from "@/lib/security";

describe("validation and security helpers", () => {
  it.each([
    ["(11) 99999-9999", "11999999999"],
    ["+55 (11) 99999-9999", "11999999999"],
    ["0055 11 99999-9999", "11999999999"],
    ["021 11 99999-9999", "11999999999"],
    ["011 3333-4444", "1133334444"],
    ["1.1999999999E+10", "11999999999"],
  ])("normalizes Brazilian phone format %s", (value, expected) => {
    expect(normalizeBrazilianPhoneForMatch(value)).toBe(expected);
  });

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

    const phoneOnly = parseConversionInput({ accountId: "acc_1", phone: "(11) 99999-9999" }, ["phone"]);
    expect(phoneOnly.ok).toBe(true);
    if (phoneOnly.ok) {
      expect(phoneOnly.data.name).toBeNull();
      expect(phoneOnly.data.email).toBeNull();
      expect(phoneOnly.data.phone).toBe("11999999999");
    }
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
      formFields: "name,email,phone",
    }).ok).toBe(false);

    expect(parseButtonConfigInput({
      position: "LEFT",
      size: "SMALL",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "ftp://example.com",
      gclidExpirationDays: 30,
      conversionName: "Lead",
      gaEventName: "whatsapp_form_submit",
      formFields: "name,email,phone",
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
      formFields: "name,email,phone",
    }).ok).toBe(false);

    const parsed = parseButtonConfigInput({
      position: "LEFT",
      size: "SMALL",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Olá! Preencha seus dados.",
      allowedOrigins: "https://example.com/, https://shop.example.com/path",
      gclidExpirationDays: "365",
      conversionName: "Lead",
      gaEventName: "whatsapp_form_submit",
      formFields: "phone,name,phone",
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.allowedOrigins).toBe("https://example.com, https://shop.example.com");
      expect(parsed.data.formFields).toBe("name,phone");
    }
  });

  it("normalizes configured form fields", () => {
    expect(parseFormFieldsInput("phone, email,wat")).toBe("email,phone");
    expect(parseFormFieldsInput("")).toBeNull();
    expect(parseFormFields("wat")).toEqual(["name", "email", "phone"]);
  });

  it("validates configured external form tracking selectors", () => {
    const parsed = parseFormTrackingInput({
      accountId: "acc_1",
      name: "Main Form",
      selector: "#form-one",
      isActive: true,
    });

    expect(parsed.ok).toBe(true);
    expect(parseFormTrackingInput({ name: "", selector: "#form-one" }).ok).toBe(false);
    expect(parseFormTrackingInput({ name: "Main", selector: "" }).ok).toBe(false);
  });

  it("accepts form conversion input with any contact field", () => {
    const emailOnly = parseFormConversionInput({
      accountId: "acc_1",
      formTrackingId: "form_1",
      email: "lead@example.com",
    });

    expect(emailOnly.ok).toBe(true);
    if (emailOnly.ok) {
      expect(emailOnly.data.email).toBe("lead@example.com");
      expect(emailOnly.data.name).toBeNull();
      expect(emailOnly.data.phone).toBeNull();
    }
    expect(parseFormConversionInput({ accountId: "acc_1", formTrackingId: "form_1" }).ok).toBe(false);
  });

  it("parses origin allow-lists as normalized URL origins", () => {
    expect(parseAllowedOrigins("*")).toEqual(["*"]);
    expect(parseAllowedOrigins("https://example.com/, https://example.com/path")).toEqual(["https://example.com"]);
    expect(isOriginAllowed("https://example.com", "https://example.com/")).toBe(true);
    expect(isOriginAllowed("https://example.com", "https://example.com/path")).toBe(true);
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
