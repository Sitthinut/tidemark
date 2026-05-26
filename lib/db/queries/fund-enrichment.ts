// Fund enrichment queries — read/write for the five SEC enrichment tables:
// fund_performance, fund_asset_allocation, fund_top_holdings,
// fund_portfolio, fund_portfolio_asset_type.
//
// Write side: upsert helpers called by the fund-catalog refresh job.
// Read side: typed getters for API routes and the advisor tool.

import { eq } from "drizzle-orm";
import { getDb } from "../context";
import {
  fundAssetAllocation,
  fundPerformance,
  fundPortfolio,
  fundPortfolioAssetType,
  fundTopHoldings,
} from "../schema";

// ─── Inferred row types ───────────────────────────────────────────────────────

export type FundPerformanceRow = typeof fundPerformance.$inferSelect;
export type FundPerformanceInsert = typeof fundPerformance.$inferInsert;

export type FundAssetAllocationRow = typeof fundAssetAllocation.$inferSelect;
export type FundAssetAllocationInsert = typeof fundAssetAllocation.$inferInsert;

export type FundTopHoldingRow = typeof fundTopHoldings.$inferSelect;
export type FundTopHoldingInsert = typeof fundTopHoldings.$inferInsert;

export type FundPortfolioRow = typeof fundPortfolio.$inferSelect;
export type FundPortfolioInsert = typeof fundPortfolio.$inferInsert;

export type FundPortfolioAssetTypeRow = typeof fundPortfolioAssetType.$inferSelect;
export type FundPortfolioAssetTypeInsert = typeof fundPortfolioAssetType.$inferInsert;

// ─── Write side ──────────────────────────────────────────────────────────────

/**
 * Replace all performance rows for a fund with a fresh set. Deletes existing
 * rows first (since the PK is (projId, fundClassName, performanceTypeDesc,
 * referencePeriod) a single insert/replace would leave orphan rows for
 * reference periods no longer in the latest factsheet).
 */
export function upsertFundPerformance(projId: string, rows: FundPerformanceInsert[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(fundPerformance).where(eq(fundPerformance.projId, projId)).run();
    for (const row of rows) {
      tx.insert(fundPerformance).values(row).run();
    }
  });
}

/**
 * Replace all asset allocation rows for a fund. The latest factsheet snapshot
 * replaces the previous one entirely (asset_seq set may differ across snapshots).
 */
export function upsertFundAssetAllocation(projId: string, rows: FundAssetAllocationInsert[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(fundAssetAllocation).where(eq(fundAssetAllocation.projId, projId)).run();
    for (const row of rows) {
      tx.insert(fundAssetAllocation).values(row).run();
    }
  });
}

/**
 * Replace all top-5 holding rows for a fund. The latest factsheet snapshot
 * replaces the previous one entirely.
 */
export function upsertFundTopHoldings(projId: string, rows: FundTopHoldingInsert[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(fundTopHoldings).where(eq(fundTopHoldings.projId, projId)).run();
    for (const row of rows) {
      tx.insert(fundTopHoldings).values(row).run();
    }
  });
}

/**
 * Replace all portfolio rows for a fund. Since we store only the LATEST
 * quarter, we delete all existing rows for this fund first, then insert
 * the new batch. This ensures stale holdings from previous quarters are
 * pruned even when the period key is the same (e.g. API restatement).
 */
export function upsertFundPortfolio(projId: string, rows: FundPortfolioInsert[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(fundPortfolio).where(eq(fundPortfolio.projId, projId)).run();
    for (const row of rows) {
      tx.insert(fundPortfolio).values(row).run();
    }
  });
}

/**
 * Replace all portfolio-asset-type rows for a fund. Same strategy as
 * upsertFundPortfolio — delete-then-insert for a clean latest snapshot.
 */
export function upsertFundPortfolioAssetType(
  projId: string,
  rows: FundPortfolioAssetTypeInsert[],
): void {
  if (rows.length === 0) return;
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(fundPortfolioAssetType).where(eq(fundPortfolioAssetType.projId, projId)).run();
    for (const row of rows) {
      tx.insert(fundPortfolioAssetType).values(row).run();
    }
  });
}

// ─── Read side ────────────────────────────────────────────────────────────────

/** All performance rows for one fund (latest snapshot). */
export function getFundPerformance(projId: string): FundPerformanceRow[] {
  return getDb().select().from(fundPerformance).where(eq(fundPerformance.projId, projId)).all();
}

/** Asset allocation rows for one fund (latest snapshot). */
export function getFundAssetAllocation(projId: string): FundAssetAllocationRow[] {
  return getDb()
    .select()
    .from(fundAssetAllocation)
    .where(eq(fundAssetAllocation.projId, projId))
    .orderBy(fundAssetAllocation.assetSeq)
    .all();
}

/** Top-5 holdings for one fund (latest snapshot), ordered by rank. */
export function getFundTopHoldings(projId: string): FundTopHoldingRow[] {
  return getDb()
    .select()
    .from(fundTopHoldings)
    .where(eq(fundTopHoldings.projId, projId))
    .orderBy(fundTopHoldings.assetSeq)
    .all();
}

/** Full portfolio for one fund (latest quarter). */
export function getFundPortfolio(projId: string): FundPortfolioRow[] {
  return getDb().select().from(fundPortfolio).where(eq(fundPortfolio.projId, projId)).all();
}

/** Portfolio by asset type for one fund (latest month). */
export function getFundPortfolioAssetType(projId: string): FundPortfolioAssetTypeRow[] {
  return getDb()
    .select()
    .from(fundPortfolioAssetType)
    .where(eq(fundPortfolioAssetType.projId, projId))
    .all();
}

/**
 * Composite fund detail — returns all enrichment data for one fund in a
 * single call. Any table that has no data returns an empty array.
 * Suitable for a fund-detail API route response body.
 */
export function getFundEnrichment(projId: string): {
  performance: FundPerformanceRow[];
  assetAllocation: FundAssetAllocationRow[];
  topHoldings: FundTopHoldingRow[];
  portfolio: FundPortfolioRow[];
  portfolioAssetType: FundPortfolioAssetTypeRow[];
} {
  return {
    performance: getFundPerformance(projId),
    assetAllocation: getFundAssetAllocation(projId),
    topHoldings: getFundTopHoldings(projId),
    portfolio: getFundPortfolio(projId),
    portfolioAssetType: getFundPortfolioAssetType(projId),
  };
}
