// Fund-catalog query contract. The subtle parts the consumers depend on:
//   1. getCurrentFees picks the open period (periodEnd NULL), else newest start.
//   2. getCurrentTer reads the Total Fee and Expense actual rate.
//   3. findFunds ranks cheapest-first and sorts funds with no TER last.
//   4. getCheaperAlternatives returns only strictly-cheaper same-class peers.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { type DbContext, runWithDbContext } from "../context";
import * as schema from "../schema";
import {
  type FundFeeInsert,
  type FundInsert,
  findFunds,
  getCheaperAlternatives,
  getCurrentFees,
  getCurrentTer,
  upsertFund,
  upsertFundFees,
} from "./funds";

function freshDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const migrationsDir = resolve("lib/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = files
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n")
    .replace(/--> statement-breakpoint/g, ";");
  sqlite.exec(sql);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

function withDb(fn: () => void) {
  const { sqlite, db } = freshDb();
  const ctx: DbContext = { db, sqlite, isDemo: false, sessionId: "s", userId: null };
  runWithDbContext(ctx, fn);
}

function fund(projId: string, over: Partial<FundInsert> = {}): FundInsert {
  return {
    projId,
    abbrName: projId,
    englishName: projId,
    assetClass: "equity",
    fundType: "Equity",
    status: "active",
    ...over,
  };
}

function ter(projId: string, actual: number, over: Partial<FundFeeInsert> = {}): FundFeeInsert {
  return {
    projId,
    fundClassName: "A",
    feeType: "total_expense",
    feeTypeRaw: "ค่าธรรมเนียมและค่าใช้จ่ายรวมทั้งหมด (Total Fee and Expense)",
    actualRatePct: actual,
    rateCeilingPct: actual + 1,
    periodStart: "2026-05-01",
    periodEnd: null,
    ...over,
  };
}

describe("getCurrentFees / getCurrentTer", () => {
  it("prefers the open period over a newer closed one", () => {
    withDb(() => {
      upsertFund(fund("F1"));
      upsertFundFees([
        ter("F1", 0.49, { periodStart: "2026-05-01", periodEnd: null }),
        ter("F1", 0.99, { periodStart: "2026-06-01", periodEnd: "2026-06-30" }),
      ]);
      expect(getCurrentTer("F1")).toBe(0.49);
    });
  });

  it("falls back to the newest closed period when none are open", () => {
    withDb(() => {
      upsertFund(fund("F2"));
      upsertFundFees([
        ter("F2", 0.8, { periodStart: "2026-01-01", periodEnd: "2026-03-31" }),
        ter("F2", 0.6, { periodStart: "2026-04-01", periodEnd: "2026-06-30" }),
      ]);
      expect(getCurrentTer("F2")).toBe(0.6);
    });
  });

  it("falls back to the ceiling rate when actual is missing", () => {
    withDb(() => {
      upsertFund(fund("F3"));
      upsertFundFees([ter("F3", 0, { actualRatePct: null, rateCeilingPct: 1.5 })]);
      expect(getCurrentTer("F3")).toBe(1.5);
    });
  });

  it("returns null when the fund has no TER row", () => {
    withDb(() => {
      upsertFund(fund("F4"));
      expect(getCurrentTer("F4")).toBeNull();
      expect(getCurrentFees("F4").total_expense).toBeUndefined();
    });
  });
});

describe("findFunds", () => {
  it("ranks cheapest-first and sorts no-TER funds last", () => {
    withDb(() => {
      upsertFund(fund("CHEAP"));
      upsertFund(fund("PRICEY"));
      upsertFund(fund("NOFEE"));
      upsertFundFees([ter("CHEAP", 0.2), ter("PRICEY", 1.1)]);
      // NOFEE has no fee rows.
      const ranked = findFunds({ assetClass: "equity" }).map((f) => f.projId);
      expect(ranked).toEqual(["CHEAP", "PRICEY", "NOFEE"]);
    });
  });

  it("filters by asset class and excludes inactive funds by default", () => {
    withDb(() => {
      upsertFund(fund("EQ"));
      upsertFund(fund("BD", { assetClass: "bond", fundType: "Fixed Income" }));
      upsertFund(fund("DEAD", { status: "inactive" }));
      upsertFundFees([ter("EQ", 0.3), ter("BD", 0.1), ter("DEAD", 0.05)]);
      const eq = findFunds({ assetClass: "equity" }).map((f) => f.projId);
      expect(eq).toEqual(["EQ"]); // not BD (bond), not DEAD (inactive)
    });
  });
});

describe("getCheaperAlternatives", () => {
  it("returns only strictly cheaper same-class peers, cheapest first", () => {
    withDb(() => {
      upsertFund(fund("HELD"));
      upsertFund(fund("CHEAPER"));
      upsertFund(fund("CHEAPEST"));
      upsertFund(fund("DEARER"));
      upsertFundFees([
        ter("HELD", 0.8),
        ter("CHEAPER", 0.5),
        ter("CHEAPEST", 0.2),
        ter("DEARER", 1.0),
      ]);
      const alts = getCheaperAlternatives("HELD").map((f) => f.projId);
      expect(alts).toEqual(["CHEAPEST", "CHEAPER"]);
    });
  });

  it("returns nothing when the held fund has no TER to compare", () => {
    withDb(() => {
      upsertFund(fund("HELD2"));
      upsertFund(fund("OTHER", {}));
      upsertFundFees([ter("OTHER", 0.1)]);
      expect(getCheaperAlternatives("HELD2")).toEqual([]);
    });
  });
});
