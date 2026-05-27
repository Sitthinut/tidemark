// Unit tests for lib/db/queries/feeder-enrichment.ts
//
// Strategy: mock the DB context (getDb) so tests run without a real SQLite
// instance. Tests cover upsert and read helpers.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the DB context ──────────────────────────────────────────────────────

vi.mock("../context", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../context";
import {
  getFeederEnrichment,
  getFeederLookThroughHoldings,
  getFeederMasterMap,
  upsertFeederLookThroughHoldings,
  upsertFeederMasterMap,
} from "./feeder-enrichment";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockDb(rows: unknown[] = []) {
  const run = vi.fn();
  const all = vi.fn().mockReturnValue(rows);
  const get = vi.fn().mockReturnValue(rows[0] ?? null);
  const orderBy = vi.fn().mockReturnValue({ all });
  const where = vi.fn().mockReturnValue({ all, orderBy, run, get });
  const values = vi.fn().mockReturnValue({
    run,
    onConflictDoUpdate: vi.fn().mockReturnValue({ run }),
  });
  const insert = vi.fn().mockReturnValue({ values });
  const deleteFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run }) });
  const txFn = vi.fn((cb: (tx: typeof mockDb) => void) => cb(mockDb));
  const mockDb = {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    insert,
    delete: deleteFrom,
    transaction: txFn,
  };
  return mockDb;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("feeder-enrichment queries", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockDb = makeMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
  });

  // ─── upsertFeederMasterMap ─────────────────────────────────────────────────

  describe("upsertFeederMasterMap", () => {
    it("calls insert with the provided row", () => {
      upsertFeederMasterMap({
        projId: "M0001_2555",
        masterIsin: "IE00B5BMR087",
        masterName: "iShares Core S&P 500 UCITS ETF",
        provider: "ishares",
      });
      expect(mockDb.insert).toHaveBeenCalledOnce();
    });
  });

  // ─── upsertFeederLookThroughHoldings ──────────────────────────────────────

  describe("upsertFeederLookThroughHoldings", () => {
    it("no-ops when rows array is empty", () => {
      upsertFeederLookThroughHoldings("M0001_2555", []);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("runs a transaction that deletes then inserts rows", () => {
      upsertFeederLookThroughHoldings("M0001_2555", [
        {
          projId: "M0001_2555",
          rank: 1,
          name: "Apple Inc",
          ticker: "AAPL",
          assetClass: "Equity",
          isin: "US0378331005",
          weightPct: 7.23,
          asOfDate: "2026-05-23",
        },
        {
          projId: "M0001_2555",
          rank: 2,
          name: "Microsoft Corp",
          ticker: "MSFT",
          assetClass: "Equity",
          isin: "US5949181045",
          weightPct: 6.6,
          asOfDate: "2026-05-23",
        },
      ]);
      expect(mockDb.transaction).toHaveBeenCalledOnce();
    });
  });

  // ─── read helpers ─────────────────────────────────────────────────────────

  describe("getFeederMasterMap", () => {
    it("returns null when no row found", () => {
      const db = makeMockDb([]);
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      const result = getFeederMasterMap("M0001_2555");
      expect(result).toBeNull();
    });

    it("returns the first row when found", () => {
      const row = { projId: "M0001_2555", masterIsin: "IE00B5BMR087" };
      const db = makeMockDb([row]);
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      const result = getFeederMasterMap("M0001_2555");
      expect(result).toEqual(row);
    });
  });

  describe("getFeederLookThroughHoldings", () => {
    it("returns empty array when no rows", () => {
      const db = makeMockDb([]);
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      const result = getFeederLookThroughHoldings("M0001_2555");
      expect(result).toEqual([]);
    });

    it("returns rows from DB", () => {
      const rows = [{ projId: "M0001_2555", rank: 1, name: "Apple Inc", weightPct: 7.23 }];
      const db = makeMockDb(rows);
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      const result = getFeederLookThroughHoldings("M0001_2555");
      expect(result).toEqual(rows);
    });
  });

  describe("getFeederEnrichment", () => {
    it("returns null masterMap and empty array when no data", () => {
      const db = makeMockDb([]);
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      const result = getFeederEnrichment("M0001_2555");
      expect(result).toMatchObject({
        masterMap: null,
        lookThroughHoldings: [],
      });
    });
  });
});
