// Integration test (real in-memory SQLite) for the portfolio/asset-type
// storage + display contract:
//   - ingest is INCREMENTAL: new periods are added, existing periods are never
//     rewritten, nothing is ever deleted (history accumulates; a re-fetch of an
//     already-stored period is a no-op);
//   - the read side shows only the LATEST period and drops the 903 grand-total
//     summary row.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { freshMarketDb } from "@/tests/db-helpers";
import { getMarketDb, runWithDbContext } from "../lib/db/context";
import {
  getFundPortfolio,
  getFundPortfolioAssetType,
  upsertFundPortfolio,
  upsertFundPortfolioAssetType,
} from "../lib/db/queries/fund-enrichment";
import * as schema from "../lib/db/schema";
import { fundCatalog, fundPortfolio } from "../lib/db/schema";

function freshDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const dir = resolve("lib/db/migrations/app");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n")
    .replace(/--> statement-breakpoint/g, ";");
  sqlite.exec(sql);
  const market = freshMarketDb();
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    marketDb: market.db,
    marketSqlite: market.sqlite,
  };
}

function withFresh<T>(fn: () => T): T {
  const { sqlite, db, marketDb, marketSqlite } = freshDb();
  return runWithDbContext(
    { appDb: db, appSqlite: sqlite, marketDb, marketSqlite, isDemo: true, sessionId: "test" },
    fn,
  ) as T;
}

describe("fund portfolio history (incremental ingest + latest-period display)", () => {
  it("adds new periods, preserves and never rewrites existing ones", () => {
    withFresh(() => {
      getMarketDb().insert(fundCatalog).values({ projId: "P1" }).run();

      // First crawl: period 202509 (one holding + a 903 grand-total row).
      upsertFundPortfolio("P1", [
        { projId: "P1", period: "202509", assetliabId: "108", issuer: "iShares", percentNav: 100 },
        {
          projId: "P1",
          period: "202509",
          assetliabId: "903",
          assetliabDesc: "total",
          percentNav: 100,
        },
      ]);

      // Second crawl: the API re-returns 202509 (with a DIFFERENT value, which
      // must be ignored) AND a new period 202512.
      upsertFundPortfolio("P1", [
        { projId: "P1", period: "202509", assetliabId: "108", issuer: "CHANGED", percentNav: 999 },
        { projId: "P1", period: "202512", assetliabId: "108", issuer: "iShares", percentNav: 101 },
        {
          projId: "P1",
          period: "202512",
          assetliabId: "903",
          assetliabDesc: "total",
          percentNav: 100,
        },
      ]);

      // Raw: both periods retained (4 rows), and 202509 keeps its ORIGINAL value.
      const raw = getMarketDb()
        .select()
        .from(fundPortfolio)
        .where(eq(fundPortfolio.projId, "P1"))
        .all();
      expect(raw).toHaveLength(4);
      const old = raw.find((r) => r.period === "202509" && r.assetliabId === "108");
      expect(old?.percentNav).toBe(100); // not overwritten by the 999 re-fetch
      expect(old?.issuer).toBe("iShares");

      // Display: latest period only, 903 dropped → just the one 108 holding.
      const shown = getFundPortfolio("P1");
      expect(shown).toHaveLength(1);
      expect(shown[0].period).toBe("202512");
      expect(shown[0].percentNav).toBe(101);
      expect(shown.some((r) => r.assetliabId === "903")).toBe(false);
    });
  });

  it("an empty re-fetch never wipes stored asset-type history", () => {
    withFresh(() => {
      getMarketDb().insert(fundCatalog).values({ projId: "P2" }).run();
      upsertFundPortfolioAssetType("P2", [
        { projId: "P2", period: "202601", assetliabCode: "108", percentNav: 99 },
        { projId: "P2", period: "202601", assetliabCode: "903", percentNav: 100 },
      ]);

      // A flaky/204 day → empty rows → no-op, history intact.
      upsertFundPortfolioAssetType("P2", []);

      const shown = getFundPortfolioAssetType("P2");
      expect(shown).toHaveLength(1); // 903 dropped
      expect(shown[0].period).toBe("202601");
      expect(shown[0].assetliabCode).toBe("108");
    });
  });
});
