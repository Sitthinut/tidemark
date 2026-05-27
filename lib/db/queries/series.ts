import { and, gte, inArray } from "drizzle-orm";
import { getAppDb, getMarketDb } from "../context";
import { holdings, navHistory } from "../schema";

export type SeriesRange = "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";

export interface SeriesPoint {
  /** ISO YYYY-MM-DD */
  date: string;
  value: number;
}

export interface PortfolioSeriesResult {
  aggregate: SeriesPoint[];
  perBucket: Record<string, SeriesPoint[]>;
  /** ISO timestamp of the most recent nav_history row used. */
  asOf: string | null;
}

function rangeStartDate(range: SeriesRange): string {
  const days =
    range === "1mo"
      ? 31
      : range === "3mo"
        ? 92
        : range === "6mo"
          ? 183
          : range === "1y"
            ? 366
            : range === "5y"
              ? 5 * 366
              : 365 * 50;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compose per-bucket and aggregate value series from `nav_history` rows.
 *
 * For each holding we forward-fill the most recent NAV onto every business
 * date between the holding's first known nav and the latest date in range.
 * That way Thai funds (which skip weekends) and US ETFs (which skip TH
 * holidays) line up on a shared timeline, and the per-date total is just
 * `sum(units * forwardFilledNav)` across holdings.
 *
 * Aggregate series is `sum(perBucket[i])` on each shared date.
 */
export function getPortfolioSeries(range: SeriesRange = "6mo"): PortfolioSeriesResult {
  // Cross-domain read: holdings live in app.db, their NAV series in market.db.
  // There is no SQL join — we read each side and join app-side on the soft
  // `${quoteSource}:${ticker}` cache key.
  const appDb = getAppDb();
  const marketDb = getMarketDb();
  const since = rangeStartDate(range);

  const allHoldings = appDb.select().from(holdings).all();
  if (allHoldings.length === 0) {
    return { aggregate: [], perBucket: {}, asOf: null };
  }

  const cacheKeys = Array.from(new Set(allHoldings.map((h) => `${h.quoteSource}:${h.ticker}`)));
  const navRows = marketDb
    .select()
    .from(navHistory)
    .where(and(inArray(navHistory.ticker, cacheKeys), gte(navHistory.date, since)))
    .orderBy(navHistory.date)
    .all();

  // ticker (cache key) → ordered [date, nav][]
  const navByKey = new Map<string, { date: string; nav: number }[]>();
  for (const r of navRows) {
    let arr = navByKey.get(r.ticker);
    if (!arr) {
      arr = [];
      navByKey.set(r.ticker, arr);
    }
    arr.push({ date: r.date, nav: r.nav });
  }

  // The shared timeline is the union of every date that ANY ticker has data
  // for, in range. We forward-fill missing values per holding.
  const dateSet = new Set<string>();
  for (const r of navRows) dateSet.add(r.date);
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) {
    return { aggregate: [], perBucket: {}, asOf: null };
  }

  // For each cache key, build a forward-fill function over the shared dates.
  const forwardFill = (key: string): Map<string, number> => {
    const out = new Map<string, number>();
    const rows = navByKey.get(key);
    if (!rows || rows.length === 0) return out;
    let i = 0;
    let last: number | null = null;
    for (const d of dates) {
      while (i < rows.length && rows[i].date <= d) {
        last = rows[i].nav;
        i++;
      }
      if (last !== null) out.set(d, last);
    }
    return out;
  };

  const filled = new Map<string, Map<string, number>>();
  for (const key of cacheKeys) filled.set(key, forwardFill(key));

  // Group holdings by bucket once so we sum efficiently.
  const byBucket = new Map<string, typeof allHoldings>();
  for (const h of allHoldings) {
    let arr = byBucket.get(h.bucketId);
    if (!arr) {
      arr = [];
      byBucket.set(h.bucketId, arr);
    }
    arr.push(h);
  }

  const perBucket: Record<string, SeriesPoint[]> = {};
  const aggregateByDate = new Map<string, number>();

  for (const [bucketId, bucketHoldings] of byBucket) {
    const series: SeriesPoint[] = [];
    for (const d of dates) {
      let value = 0;
      let anyValue = false;
      for (const h of bucketHoldings) {
        const key = `${h.quoteSource}:${h.ticker}`;
        const nav = filled.get(key)?.get(d);
        if (nav !== undefined) {
          value += h.units * nav;
          anyValue = true;
        }
      }
      // Skip leading dates where no holding in this bucket has data yet.
      if (anyValue) {
        series.push({ date: d, value });
        aggregateByDate.set(d, (aggregateByDate.get(d) ?? 0) + value);
      }
    }
    perBucket[bucketId] = series;
  }

  const aggregate: SeriesPoint[] = dates
    .filter((d) => aggregateByDate.has(d))
    .map((d) => ({ date: d, value: aggregateByDate.get(d) ?? 0 }));

  return {
    aggregate,
    perBucket,
    asOf: dates[dates.length - 1] ?? null,
  };
}
