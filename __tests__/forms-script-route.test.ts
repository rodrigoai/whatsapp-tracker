import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: jest.fn(),
    },
  },
}));

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { GET } = require("@/app/api/forms/script.js/route") as typeof import("@/app/api/forms/script.js/route");
const mockFindAccount = prisma.account.findUnique as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;

describe("forms tracking script route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    window.localStorage.clear();
    Reflect.deleteProperty(window, "ttq");
    mockFindAccount.mockResolvedValue({
      id: "acc_1",
      buttonConfig: { gclidExpirationDays: 30 },
      formTrackings: [
        { id: "form_1", name: "Main Form", selector: "#form-one" },
      ],
    });
  });

  async function getScript() {
    const response = await GET(new Request("https://tracker.test/api/forms/script.js?accountId=acc_1"));
    expect(response.status).toBe(200);
    return response.text();
  }

  async function flushAsyncEventHandler() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it("serializes active forms and posts detected lead fields on submit", async () => {
    const script = await getScript();
    const ttqTrack = jest.fn();
    const fetchMock = jest.fn((..._args: unknown[]) => Promise.resolve({
      ok: true,
      json: async () => ({ success: true }),
    } as unknown));
    Object.defineProperties(window, {
      fetch: { value: fetchMock, configurable: true },
      ttq: { value: { track: ttqTrack }, configurable: true },
    });
    document.body.innerHTML = `
      <form id="form-one">
        <label for="nome">Nome completo</label>
        <input id="nome" name="Nome" value="Maria Souza" />
        <input name="E-mail" type="email" value="maria@example.com" />
        <input name="Celular" type="tel" value="(11) 99999-9999" />
        <button type="submit">Enviar</button>
      </form>
    `;

    window.eval(script);
    const form = document.getElementById("form-one") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncEventHandler();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tracker.test/api/form-conversion?accountId=acc_1",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      })
    );
    const [, requestOptions] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(requestOptions.body))).toEqual(expect.objectContaining({
      accountId: "acc_1",
      formTrackingId: "form_1",
      name: "Maria Souza",
      email: "maria@example.com",
      phone: "11999999999",
    }));
    expect(ttqTrack).toHaveBeenCalledTimes(1);
    expect(ttqTrack).toHaveBeenCalledWith("Lead");
    expect(script).toContain("window.ttq.track(eventName)");
  });

  it("does not fire TikTok Lead or post a conversion when no lead field is recognized", async () => {
    const script = await getScript();
    const ttqTrack = jest.fn();
    const fetchMock = jest.fn();
    Object.defineProperties(window, {
      fetch: { value: fetchMock, configurable: true },
      ttq: { value: { track: ttqTrack }, configurable: true },
    });
    document.body.innerHTML = `
      <form id="form-one">
        <input name="company_department" value="Sales" />
      </form>
    `;

    window.eval(script);
    (document.getElementById("form-one") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true })
    );
    await flushAsyncEventHandler();

    expect(ttqTrack).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still posts the conversion when TikTok Pixel throws", async () => {
    const script = await getScript();
    const pixelError = new Error("TikTok unavailable");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as unknown));
    Object.defineProperties(window, {
      fetch: { value: fetchMock, configurable: true },
      ttq: {
        value: { track: jest.fn(() => { throw pixelError; }) },
        configurable: true,
      },
    });
    document.body.innerHTML = `
      <form id="form-one">
        <input type="email" value="lead@example.com" />
      </form>
    `;

    window.eval(script);
    (document.getElementById("form-one") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true })
    );
    await flushAsyncEventHandler();

    expect(warn).toHaveBeenCalledWith(
      "[WA Tracker Forms] TikTok Pixel event failed",
      pixelError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("ignores TikTok Lead when TikTok Pixel is not installed", async () => {
    const script = await getScript();
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as unknown));
    Object.defineProperty(window, "fetch", { value: fetchMock, configurable: true });
    document.body.innerHTML = `
      <form id="form-one">
        <input type="email" value="lead@example.com" />
      </form>
    `;

    expect(Reflect.has(window, "ttq")).toBe(false);
    window.eval(script);
    expect(() => {
      (document.getElementById("form-one") as HTMLFormElement).dispatchEvent(
        new Event("submit", { bubbles: true })
      );
    }).not.toThrow();
    await flushAsyncEventHandler();

    expect(Reflect.has(window, "ttq")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores and submits click ids from the page URL", async () => {
    const script = await getScript();
    const fetchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true } as unknown));
    Object.defineProperty(window, "fetch", { value: fetchMock, configurable: true });
    window.history.pushState({}, "", "/landing?gclid=abc123&utm_campaign=sale");
    document.body.innerHTML = `
      <form id="form-one">
        <input autocomplete="email" value="lead@example.com" />
      </form>
    `;

    window.eval(script);
    (document.getElementById("form-one") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true }));
    await flushAsyncEventHandler();

    const [, requestOptions] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(requestOptions.body))).toEqual(expect.objectContaining({
      email: "lead@example.com",
      gclid: "abc123",
      utm_campaign: "sale",
    }));
  });

  it("ignores invalid selectors without breaking other configured forms", async () => {
    mockFindAccount.mockResolvedValue({
      id: "acc_1",
      buttonConfig: { gclidExpirationDays: 30 },
      formTrackings: [
        { id: "bad", name: "Bad", selector: "[" },
        { id: "form_1", name: "Main Form", selector: "#form-one" },
      ],
    });
    const script = await getScript();
    const fetchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true } as unknown));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(window, "fetch", { value: fetchMock, configurable: true });
    document.body.innerHTML = `
      <form id="form-one">
        <input name="phone" value="11999999999" />
      </form>
    `;

    window.eval(script);
    (document.getElementById("form-one") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true }));
    await flushAsyncEventHandler();

    expect(warn).toHaveBeenCalledWith(
      "[WA Tracker Forms] Invalid selector",
      "[",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
