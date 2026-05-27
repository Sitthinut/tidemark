// Unit tests for lib/market/providers/ishares.ts
//
// Strategy: stub global fetch to return synthetic CSV payloads. Tests cover
// CSV parsing, URL construction, ISIN registry lookup, and empty/error paths.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCsvUrl,
  fetchISharesHoldings,
  fetchISharesHoldingsByIsin,
  ISHARES_PRODUCTS,
  matchISharesMaster,
  parseCsvLine,
  parseISharesCsv,
} from "./ishares";

// ─── Synthetic CSV fixture ────────────────────────────────────────────────────

const SYNTHETIC_CSV = `"Fund Holdings as of","May 23, 2026","",""
"Inception Date","May 15, 2000","",""
"Name","Ticker","Asset Class","Market Value","Weight (%)","Notional Value","Shares","CUSIP","ISIN"
"Apple Inc","AAPL","Equity","350000000","7.23","350000000","1900000","037833100","US0378331005"
"Microsoft Corp","MSFT","Equity","320000000","6.60","320000000","1000000","594918104","US5949181045"
"NVIDIA Corp","NVDA","Equity","280000000","5.78","280000000","2300000","67066G104","US67066G1040"
"Amazon.com Inc","AMZN","Equity","230000000","4.75","230000000","1300000","023135106","US0231351067"
"Cash & Derivatives","","Cash","-","-","-","-","",""\
`;

const SYNTHETIC_CSV_ISO_DATE = `"Fund Holdings as of","2026-05-23","",""
"Inception Date","2000-05-15","",""
"Name","Ticker","Asset Class","Market Value","Weight (%)","Notional Value","Shares","CUSIP","ISIN"
"Apple Inc","AAPL","Equity","350000000","7.23","350000000","1900000","037833100","US0378331005"
`;

const SYNTHETIC_CSV_EMPTY = `"Fund Holdings as of","May 23, 2026","",""
"Inception Date","May 15, 2000","",""
"Name","Ticker","Asset Class","Market Value","Weight (%)","Notional Value","Shares","CUSIP","ISIN"
`;

// ─── Setup ────────────────────────────────────────────────────────────────────

describe("iShares provider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ─── parseCsvLine ──────────────────────────────────────────────────────────

  describe("parseCsvLine", () => {
    it("splits a simple comma-separated line", () => {
      expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("handles quoted fields containing commas", () => {
      expect(parseCsvLine('"Apple, Inc","AAPL","7.23"')).toEqual(["Apple, Inc", "AAPL", "7.23"]);
    });

    it("handles empty fields", () => {
      expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
    });

    it("handles double-quote escape inside quoted field", () => {
      expect(parseCsvLine('"He said ""hi""","next"')).toEqual(['He said "hi"', "next"]);
    });
  });

  // ─── parseISharesCsv ──────────────────────────────────────────────────────

  describe("parseISharesCsv", () => {
    it("returns empty array for empty input", () => {
      expect(parseISharesCsv("")).toEqual([]);
    });

    it("returns empty array for CSV with fewer than 4 lines", () => {
      expect(parseISharesCsv("row1\nrow2\nrow3")).toEqual([]);
    });

    it("parses valid CSV and returns sorted rows", () => {
      const rows = parseISharesCsv(SYNTHETIC_CSV);
      // Cash row is filtered out; 4 equity rows remain
      expect(rows.length).toBe(4);
      // Sorted by weight desc — Apple first (7.23%)
      expect(rows[0].name).toBe("Apple Inc");
      expect(rows[0].ticker).toBe("AAPL");
      expect(rows[0].weightPct).toBeCloseTo(7.23);
      expect(rows[0].isin).toBe("US0378331005");
      expect(rows[0].assetClass).toBe("Equity");
    });

    it("parses as-of date in 'Month DD, YYYY' format", () => {
      const rows = parseISharesCsv(SYNTHETIC_CSV);
      expect(rows[0].asOfDate).toBe("2026-05-23");
    });

    it("parses as-of date in ISO 'YYYY-MM-DD' format", () => {
      const rows = parseISharesCsv(SYNTHETIC_CSV_ISO_DATE);
      expect(rows[0].asOfDate).toBe("2026-05-23");
    });

    it("returns empty array when CSV has headers but no data rows", () => {
      const rows = parseISharesCsv(SYNTHETIC_CSV_EMPTY);
      expect(rows).toEqual([]);
    });

    it("handles missing weight column gracefully", () => {
      const csv = `"Fund Holdings as of","2026-05-23","",""
"Inception Date","2000-05-15","",""
"Name","Ticker","Asset Class"
"Apple Inc","AAPL","Equity"
`;
      // No weight column — should return empty (weight required for sort)
      const rows = parseISharesCsv(csv);
      expect(rows).toEqual([]);
    });
  });

  // ─── buildCsvUrl ──────────────────────────────────────────────────────────

  describe("buildCsvUrl", () => {
    it("builds a stable iShares CSV download URL", () => {
      const url = buildCsvUrl({ productId: "239726", slug: "ishares-core-sp-500-etf" });
      expect(url).toContain("239726");
      expect(url).toContain("ishares-core-sp-500-etf");
      expect(url).toContain("tab=holdings");
      expect(url).toContain("fileType=csv");
      expect(url.startsWith("https://www.ishares.com")).toBe(true);
    });
  });

  // ─── fetchISharesHoldings ─────────────────────────────────────────────────

  describe("fetchISharesHoldings", () => {
    it("returns parsed rows on 200 OK with valid CSV", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SYNTHETIC_CSV),
      } as Response);

      const rows = await fetchISharesHoldings({
        productId: "239726",
        slug: "ishares-core-sp-500-etf",
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].name).toBe("Apple Inc");
    });

    it("returns empty array on non-200 HTTP response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const rows = await fetchISharesHoldings({ productId: "239726", slug: "test" });
      expect(rows).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("network timeout"));

      const rows = await fetchISharesHoldings({ productId: "239726", slug: "test" });
      expect(rows).toEqual([]);
    });
  });

  // ─── fetchISharesHoldingsByIsin ───────────────────────────────────────────

  describe("fetchISharesHoldingsByIsin", () => {
    it("returns empty array for unregistered ISIN", async () => {
      const rows = await fetchISharesHoldingsByIsin("XX9999999999");
      expect(rows).toEqual([]);
      // fetch should not have been called
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls fetch for a registered ISIN (IVV — US S&P 500)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SYNTHETIC_CSV),
      } as Response);

      // IVV ISIN is in ISHARES_PRODUCTS
      const rows = await fetchISharesHoldingsByIsin("US4642872265");
      expect(fetch).toHaveBeenCalledOnce();
      expect(rows.length).toBeGreaterThan(0);
    });

    it("is case-insensitive for ISIN lookup", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SYNTHETIC_CSV),
      } as Response);

      const rows = await fetchISharesHoldingsByIsin("us4642872265");
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // ─── ISHARES_PRODUCTS registry ────────────────────────────────────────────

  describe("ISHARES_PRODUCTS registry", () => {
    it("contains expected common ETF ISINs", () => {
      // S&P 500 UCITS (CSPX)
      expect(ISHARES_PRODUCTS.IE00B5BMR087).toBeDefined();
      // S&P 500 US (IVV)
      expect(ISHARES_PRODUCTS.US4642872265).toBeDefined();
      // MSCI World (IWDA)
      expect(ISHARES_PRODUCTS.IE00B4L5Y983).toBeDefined();
    });

    it("each registry entry has productId, slug, and a primaryKeyword", () => {
      for (const [isin, ref] of Object.entries(ISHARES_PRODUCTS)) {
        expect(ref.productId, `${isin} missing productId`).toBeTruthy();
        expect(ref.slug, `${isin} missing slug`).toBeTruthy();
        expect(ref.primaryKeyword, `${isin} missing primaryKeyword`).toBeTruthy();
      }
    });
  });

  describe("matchISharesMaster", () => {
    it("maps a UCITS S&P 500 master name to the UCITS ISIN (keyword tie-break)", () => {
      // Both S&P products share primaryKeyword "s&p 500"; "ucits" breaks the tie.
      expect(matchISharesMaster("iShares Core S&P 500 UCITS ETF")).toBe("IE00B5BMR087");
    });

    it("maps a NASDAQ-100 UCITS master to CNDX (keyword tie-break)", () => {
      expect(matchISharesMaster("iShares NASDAQ 100 UCITS ETF")).toBe("IE00B53SZB19");
    });

    it("maps an MSCI World master to IWDA — never to an S&P product", () => {
      expect(matchISharesMaster("iShares Core MSCI World UCITS ETF")).toBe("IE00B4L5Y983");
    });

    it("returns null for a bare S&P 500 name (UCITS vs US tie → needs explicit map)", () => {
      // No "ucits" token to disambiguate the two S&P entries → safe skip.
      expect(matchISharesMaster("iShares Core S&P 500 ETF")).toBeNull();
    });

    it("returns null when no registry primaryKeyword is present", () => {
      expect(matchISharesMaster("Vanguard FTSE All-World UCITS ETF")).toBeNull();
    });

    it("returns null on an ambiguous same-asset tie (no disambiguating keyword)", () => {
      // "s&p 500" with no "ucits" → CSPX score 1, IVV score 1 → tie → skip.
      expect(matchISharesMaster("Some S&P 500 Index Tracker")).toBeNull();
    });

    it("is case-insensitive", () => {
      expect(matchISharesMaster("ISHARES CORE MSCI WORLD UCITS ETF")).toBe("IE00B4L5Y983");
    });
  });
});
