import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSecThailandCache, secThailandProvider } from "./sec-thailand";

// All test data is synthetic. No real Thai fund codes appear in this file.
const FAKE_AMC = { unique_id: "amc-synthetic-1" };
const FAKE_FUND = {
  proj_id: "proj-synthetic-fund-a",
  proj_abbr_name: "EXAMPLE-FUND-A",
  proj_name_en: "Example Fund A",
  fund_status: "RG",
};

function makeFetchStub() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/FundFactsheet/fund/amc")) {
      return new Response(JSON.stringify([FAKE_AMC]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith(`/FundFactsheet/fund/amc/${FAKE_AMC.unique_id}`)) {
      return new Response(JSON.stringify([FAKE_FUND]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const dailyMatch = url.match(/\/FundDailyInfo\/([^/]+)\/dailynav\/(\d{4}-\d{2}-\d{2})$/);
    if (dailyMatch) {
      // Synthetic NAV: predictable price per date so tests can assert.
      const date = dailyMatch[2];
      const dayOfMonth = Number(date.slice(-2));
      // 204 on weekends (synthesize a gap pattern).
      const dow = new Date(date).getUTCDay();
      if (dow === 0 || dow === 6) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ last_val: 10 + dayOfMonth / 100, nav_date: date }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("sec-thailand provider", () => {
  beforeEach(() => {
    __resetSecThailandCache();
    process.env.SEC_API_KEY = "test-key-synthetic";
    // Only fake Date; keep setTimeout real-but-fast so the provider's rate
    // limiter doesn't deadlock against fake timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.SEC_API_KEY;
  });

  it("matches thfund: prefixed symbols only", () => {
    expect(secThailandProvider.matches("thfund:EXAMPLE-FUND-A")).toBe(true);
    expect(secThailandProvider.matches("AAPL")).toBe(false);
    expect(secThailandProvider.matches("^SET.BK")).toBe(false);
  });

  it("resolves fund abbreviation to proj_id and returns series", async () => {
    const fetchStub = makeFetchStub();
    vi.stubGlobal("fetch", fetchStub);

    const result = await secThailandProvider.fetchSeries("thfund:EXAMPLE-FUND-A", "1mo", "1d");

    expect(result.series.length).toBeGreaterThan(0);
    expect(result.quote.symbol).toBe("thfund:EXAMPLE-FUND-A");
    expect(result.quote.currency).toBe("THB");
    expect(result.quote.name).toBe("Example Fund A");
    // Series only contains weekdays (weekends return 204).
    const weekendHits = result.series.filter((p) => {
      const dow = new Date(p.t * 1000).getUTCDay();
      return dow === 0 || dow === 6;
    });
    expect(weekendHits.length).toBe(0);

    // Hits the factsheet endpoints exactly once each thanks to the cache.
    const calls = fetchStub.mock.calls.map((c) => (c[0] as URL | string).toString());
    const factsheetCalls = calls.filter((u) => u.includes("/FundFactsheet/"));
    expect(factsheetCalls.length).toBe(2); // amc list + fund list for one amc
  });

  it("uppercases the abbreviation when looking up funds", async () => {
    const fetchStub = makeFetchStub();
    vi.stubGlobal("fetch", fetchStub);

    const result = await secThailandProvider.fetchSeries("thfund:example-fund-a", "1mo", "1d");
    expect(result.quote.name).toBe("Example Fund A");
  });

  it("throws a clear error when the fund code is not in the index", async () => {
    const fetchStub = makeFetchStub();
    vi.stubGlobal("fetch", fetchStub);

    await expect(
      secThailandProvider.fetchSeries("thfund:UNKNOWN-FUND-X", "1mo", "1d"),
    ).rejects.toThrow(/Unknown Thai fund code/);
  });

  it("throws when SEC_API_KEY is missing", async () => {
    delete process.env.SEC_API_KEY;
    const fetchStub = makeFetchStub();
    vi.stubGlobal("fetch", fetchStub);

    await expect(
      secThailandProvider.fetchSeries("thfund:EXAMPLE-FUND-A", "1mo", "1d"),
    ).rejects.toThrow(/SEC_API_KEY is not set/);
  });

  it("propagates 401 as ProviderError", async () => {
    const fetchStub = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchStub);

    await expect(
      secThailandProvider.fetchSeries("thfund:EXAMPLE-FUND-A", "1mo", "1d"),
    ).rejects.toThrow(/rejected the subscription key/);
  });

  it("treats HTTP 421 as a rate-limit error (new portal)", async () => {
    const fetchStub = vi.fn(async () => new Response("too many", { status: 421 }));
    vi.stubGlobal("fetch", fetchStub);

    await expect(
      secThailandProvider.fetchSeries("thfund:EXAMPLE-FUND-A", "1mo", "1d"),
    ).rejects.toThrow(/rate-limited \(421\)/);
  });
});
