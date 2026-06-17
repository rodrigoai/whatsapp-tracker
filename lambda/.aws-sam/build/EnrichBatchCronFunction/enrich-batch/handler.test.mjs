import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// handler.mjs uses the global fetch — we replace it per test
let fetchMock;
global.fetch = (...args) => fetchMock(...args);

const { handler } = await import("./handler.mjs");

function setEnv(overrides = {}) {
  process.env.API_SECRET = "test-secret";
  process.env.BATCH_ENRICHMENT_API_URL = "https://example.com";
  Object.assign(process.env, overrides);
}

function clearEnv() {
  delete process.env.API_SECRET;
  delete process.env.BATCH_ENRICHMENT_API_URL;
}

describe("handler", () => {
  afterEach(clearEnv);

  describe("env var validation", () => {
    it("throws if API_SECRET missing", async () => {
      setEnv({ API_SECRET: "" });
      fetchMock = mock.fn();
      await assert.rejects(() => handler(), /API_SECRET/);
      assert.equal(fetchMock.mock.calls.length, 0);
    });

    it("throws if BATCH_ENRICHMENT_API_URL missing", async () => {
      setEnv({ BATCH_ENRICHMENT_API_URL: "" });
      fetchMock = mock.fn();
      await assert.rejects(() => handler(), /BATCH_ENRICHMENT_API_URL/);
      assert.equal(fetchMock.mock.calls.length, 0);
    });
  });

  describe("successful call", () => {
    it("logs queued count and does not throw on 202", async () => {
      setEnv();
      fetchMock = mock.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => ({ queued: 5 }),
      }));
      const logs = [];
      const orig = console.log;
      console.log = (...a) => logs.push(a.join(" "));
      await handler();
      console.log = orig;
      assert.ok(logs.some((l) => l.includes("5 leads")));
    });

    it("sends today's UTC date in request body", async () => {
      setEnv();
      let sentBody;
      fetchMock = mock.fn(async (_, opts) => {
        sentBody = JSON.parse(opts.body);
        return { ok: true, status: 202, json: async () => ({ queued: 0 }) };
      });
      await handler();
      const expectedDate = new Date().toISOString().split("T")[0];
      assert.equal(sentBody.date, expectedDate);
    });

    it("sends Authorization: Bearer header with the secret", async () => {
      setEnv();
      let sentHeaders;
      fetchMock = mock.fn(async (_, opts) => {
        sentHeaders = opts.headers;
        return { ok: true, status: 202, json: async () => ({ queued: 0 }) };
      });
      await handler();
      assert.equal(sentHeaders.Authorization, "Bearer test-secret");
    });
  });

  describe("error handling", () => {
    it("logs error and throws on non-2xx response", async () => {
      setEnv();
      fetchMock = mock.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      }));
      await assert.rejects(() => handler(), /401/);
    });

    it("logs error and throws on network failure", async () => {
      setEnv();
      fetchMock = mock.fn(async () => {
        throw new Error("ECONNREFUSED");
      });
      await assert.rejects(() => handler(), /ECONNREFUSED/);
    });
  });
});
