import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { waitFor } from "@testing-library/dom";

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
const nativeWindowSetTimeout = window.setTimeout;

describe("tracking script route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    window.localStorage.clear();
    Reflect.deleteProperty(window, "ttq");
    Object.defineProperty(window, "setTimeout", { value: nativeWindowSetTimeout, configurable: true });
  });

  async function getScript(overrides: Record<string, unknown> = {}) {
    mockFindUnique.mockResolvedValue({
      id: "cfg_1",
      accountId: "acc_1",
      position: "RIGHT",
      size: "LARGE",
      primaryColor: "#25D366",
      buttonText: "Chat",
      balloonText: "Tell us where to route you.",
      allowedOrigins: "https://example.com",
      gclidExpirationDays: 30,
      conversionName: "WhatsApp Lead",
      gaEventName: "whatsapp_form_submit",
      formFields: "name,email,phone",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const response = await GET(new Request("https://tracker.test/api/script.js?accountId=acc_1"));
    return response.text();
  }

  async function flushAsyncEventHandler() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

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
      formFields: "name,email,phone",
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
    expect(script).toContain("autocomplete: 'name'");
    expect(script).toContain("autocomplete: 'email'");
    expect(script).toContain("autocomplete: 'tel-national'");
    expect(script).toContain("form.reportValidity()");
    expect(script).toContain("phoneInput.addEventListener('input'");
    expect(script).toContain('"gaEventName":"whatsapp_form_submit"');
    expect(script).toContain('"formFields":["name","email","phone"]');
    expect(script).toContain("window.gtag('event', CONFIG.gaEventName");
    expect(script).toContain("window.dataLayer.push");
    expect(script).toContain("event_callback: finish");
    expect(script).toContain("transport_type: 'beacon'");
    expect(script).toContain("trackGoogleAnalyticsEvent(data");
    expect(script).toContain("trackMetaPixelEvent('Contact')");
    expect(script).toContain("trackMetaPixelEvent('Lead')");
    expect(script).toContain("window.fbq('track', eventName)");
    expect(script).toContain("trackTikTokPixelEvent('Contact', {");
    expect(script).not.toContain("trackTikTokPixelEvent('Lead')");
    expect(script).toContain("window.ttq.identify(identity)");
    expect(script).toContain("window.ttq.track(eventName, eventData)");
    expect(script).toContain("/api/conversion?accountId=");
    expect(script).toContain('\\"; window.__owned = true;');
    expect(script).toContain('\\"texto\\"');
  });

  it("fires Meta Pixel Contact but no TikTok event when the WhatsApp button opens", async () => {
    const script = await getScript();
    const fbq = jest.fn();
    const ttqTrack = jest.fn();
    Object.defineProperties(window, {
      fbq: { value: fbq, configurable: true },
      ttq: { value: { track: ttqTrack }, configurable: true },
    });

    window.eval(script);
    document.getElementById("wa-tracking-button")?.click();

    expect(fbq).toHaveBeenCalledWith("track", "Contact");
    expect(ttqTrack).not.toHaveBeenCalled();
    expect(document.getElementById("wa-tracking-modal")?.style.display).toBe("block");
  });

  it("does not call TikTok Pixel when the widget only opens", async () => {
    const script = await getScript();
    const pixelError = new Error("TikTok unavailable");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(window, "ttq", {
      value: { track: jest.fn(() => { throw pixelError; }) },
      configurable: true,
    });

    window.eval(script);
    expect(() => document.getElementById("wa-tracking-button")?.click()).not.toThrow();

    expect(document.getElementById("wa-tracking-modal")?.style.display).toBe("block");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores TikTok Contact when TikTok Pixel is not installed", async () => {
    const script = await getScript();
    const fbq = jest.fn();
    const gtag = jest.fn();
    const fetchMock = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({
        attendantName: "Ana",
        mobileUrl: "https://api.whatsapp.com/send?phone=5511999999999",
        desktopUrl: "https://api.whatsapp.com/send?phone=5511999999999",
      }),
    }));
    Object.defineProperties(window, {
      fbq: { value: fbq, configurable: true },
      gtag: { value: gtag, configurable: true },
      fetch: { value: fetchMock, configurable: true },
      setTimeout: { value: jest.fn(), configurable: true },
    });

    expect(Reflect.has(window, "ttq")).toBe(false);
    window.eval(script);
    expect(() => document.getElementById("wa-tracking-button")?.click()).not.toThrow();

    const form = document.getElementById("wa-tracking-form") as HTMLFormElement;
    jest.spyOn(form, "checkValidity").mockReturnValue(true);
    (document.getElementById("wa-name") as HTMLInputElement).value = "Maria Souza";
    (document.getElementById("wa-email") as HTMLInputElement).value = "maria@example.com";
    (document.getElementById("wa-phone") as HTMLInputElement).value = "(11) 99999-9999";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncEventHandler();

    expect(Reflect.has(window, "ttq")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "Contact");
    expect(fbq).toHaveBeenCalledWith("track", "Lead");
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "whatsapp_form_submit",
      expect.any(Object)
    );
  });

  it("fires the configured events only after a successful lead submission", async () => {
    const script = await getScript({ gaEventName: "qualified_whatsapp_lead" });
    const fbq = jest.fn();
    const ttqTrack = jest.fn();
    const ttqIdentify = jest.fn();
    const gtag = jest.fn();
    const setTimeoutMock = jest.fn();
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    Object.defineProperties(window, {
      fbq: { value: fbq, configurable: true },
      ttq: { value: { track: ttqTrack, identify: ttqIdentify }, configurable: true },
      gtag: { value: gtag, configurable: true },
      fetch: { value: fetchMock, configurable: true },
      setTimeout: { value: setTimeoutMock, configurable: true },
    });

    window.eval(script);
    const form = document.getElementById("wa-tracking-form") as HTMLFormElement;
    jest.spyOn(form, "checkValidity").mockReturnValue(true);
    (document.getElementById("wa-name") as HTMLInputElement).value = "Maria Souza";
    (document.getElementById("wa-email") as HTMLInputElement).value = " Maria@Example.COM ";
    (document.getElementById("wa-phone") as HTMLInputElement).value = "(11) 99999-9999";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncEventHandler();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tracker.test/api/conversion?accountId=acc_1",
      expect.objectContaining({ method: "POST" })
    );
    expect(fbq).not.toHaveBeenCalledWith("track", "Lead");
    expect(ttqTrack).not.toHaveBeenCalled();
    expect(ttqIdentify).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();

    resolveFetch({
      ok: true,
      json: async () => ({
        attendantName: "Ana",
        mobileUrl: "https://api.whatsapp.com/send?phone=5511999999999",
        desktopUrl: "https://api.whatsapp.com/send?phone=5511999999999",
      }),
    });
    await flushAsyncEventHandler();

    expect(fbq).toHaveBeenCalledWith("track", "Lead");
    expect(ttqIdentify).toHaveBeenCalledTimes(1);
    expect(ttqIdentify).toHaveBeenCalledWith({
      email: "maria@example.com",
      phone_number: "+5511999999999",
    });
    expect(ttqTrack).toHaveBeenCalledTimes(1);
    expect(ttqTrack).toHaveBeenCalledWith("Contact", {
      content_ids: ["acc_1"],
      content_name: "Chat",
      content_type: "product",
    });
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "qualified_whatsapp_lead",
      expect.objectContaining({
        attendant_name: "Ana",
        transport_type: "beacon",
      })
    );
    expect(consoleLog).toHaveBeenCalledWith(
      "[WhatsApp Tracking] Google Analytics event",
      "qualified_whatsapp_lead",
      expect.objectContaining({
        account_id: "acc_1",
        attendant_name: "Ana",
      })
    );
    expect(consoleLog.mock.invocationCallOrder[0]).toBeLessThan(gtag.mock.invocationCallOrder[0]);
    consoleLog.mockRestore();
  });

  it("renders only configured form inputs and submits nulls for hidden fields", async () => {
    const script = await getScript({ formFields: "phone" });
    const ttqTrack = jest.fn();
    const ttqIdentify = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attendantName: "Ana",
        mobileUrl: "https://api.whatsapp.com/send?phone=5511999999999",
        desktopUrl: "https://api.whatsapp.com/send?phone=5511999999999",
      }),
    });
    Object.defineProperties(window, {
      fetch: { value: fetchMock, configurable: true },
      ttq: { value: { track: ttqTrack, identify: ttqIdentify }, configurable: true },
      setTimeout: { value: jest.fn(), configurable: true },
    });

    window.eval(script);

    expect(document.getElementById("wa-name")).toBeNull();
    expect(document.getElementById("wa-email")).toBeNull();
    expect(document.getElementById("wa-phone")).toBeInTheDocument();

    const form = document.getElementById("wa-tracking-form") as HTMLFormElement;
    jest.spyOn(form, "checkValidity").mockReturnValue(true);
    (document.getElementById("wa-phone") as HTMLInputElement).value = "(11) 99999-9999";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncEventHandler();

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body)).toEqual(expect.objectContaining({
      name: null,
      email: null,
      phone: "11999999999",
    }));
    expect(ttqIdentify).toHaveBeenCalledWith({
      phone_number: "+5511999999999",
    });
    expect(ttqTrack).toHaveBeenCalledWith("Contact", {
      content_ids: ["acc_1"],
      content_name: "Chat",
      content_type: "product",
    });
  });

  it("shows the error and stops tracking and redirect behavior when submission fails", async () => {
    const script = await getScript();
    const fbq = jest.fn();
    const ttqTrack = jest.fn();
    const ttqIdentify = jest.fn();
    const gtag = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "No attendants available" }),
    });
    Object.defineProperties(window, {
      fbq: { value: fbq, configurable: true },
      ttq: { value: { track: ttqTrack, identify: ttqIdentify }, configurable: true },
      gtag: { value: gtag, configurable: true },
      fetch: { value: fetchMock, configurable: true },
    });

    window.eval(script);
    const form = document.getElementById("wa-tracking-form") as HTMLFormElement;
    jest.spyOn(form, "checkValidity").mockReturnValue(true);
    (document.getElementById("wa-name") as HTMLInputElement).value = "Maria Souza";
    (document.getElementById("wa-email") as HTMLInputElement).value = "maria@example.com";
    (document.getElementById("wa-phone") as HTMLInputElement).value = "(11) 99999-9999";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect((document.getElementById("wa-tracking-error") as HTMLElement).innerText).toBe("No attendants available");
    });

    const error = document.getElementById("wa-tracking-error") as HTMLElement;
    const submit = document.getElementById("wa-tracking-submit") as HTMLButtonElement;
    expect(error).toHaveStyle({ display: "block" });
    expect(submit).not.toBeDisabled();
    expect(submit.innerText).toBe("Continuar para o WhatsApp");
    expect(fbq).not.toHaveBeenCalledWith("track", "Lead");
    expect(ttqTrack).not.toHaveBeenCalled();
    expect(ttqIdentify).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("returns a JavaScript error for unknown account configs", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(new Request("https://tracker.test/api/script.js?accountId=missing"));

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Account config not found");
  });
});
