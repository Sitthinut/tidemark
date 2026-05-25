import "server-only";
import { getCachedSeries } from "./cache";
import type { SeriesRange } from "./providers/types";

/**
 * Selectable benchmarks for the portfolio performance comparison and for the
 * advisor's `read_performance` tool. These are real index series (via the
 * market cache), not the old static placeholders. The SET is first — it's the
 * core "match your index" reference for a Thai investor; goal-based / user-added
 * benchmarks build on this list.
 */
export interface BenchmarkOption {
  /** Stable slug used as the selection key + API param. */
  key: string;
  /** UI label. */
  label: string;
  /** Provider source (matches the quote_source taxonomy). */
  source: string;
  /** Provider symbol. */
  ticker: string;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { key: "set", label: "SET", source: "yahoo", ticker: "^SET.BK" },
  { key: "sp500", label: "S&P 500", source: "yahoo", ticker: "^GSPC" },
  { key: "nasdaq", label: "Nasdaq", source: "yahoo", ticker: "^IXIC" },
  { key: "nikkei", label: "Nikkei", source: "yahoo", ticker: "^N225" },
];

export function findBenchmark(key: string): BenchmarkOption | undefined {
  return BENCHMARK_OPTIONS.find((b) => b.key === key);
}

export interface BenchmarkSeriesPoint {
  /** ISO YYYY-MM-DD */
  date: string;
  value: number;
}

/**
 * Real index series for a benchmark over `range`, from the market cache
 * (stale-tolerant). Returns `[]` when the key is unknown or the upstream is
 * cold / backing off — callers treat an empty series as "unavailable", never
 * as zero.
 */
export async function getBenchmarkSeries(
  key: string,
  range: SeriesRange = "6mo",
): Promise<BenchmarkSeriesPoint[]> {
  const b = findBenchmark(key);
  if (!b) return [];
  try {
    const cached = await getCachedSeries(b.source, b.ticker, range);
    return cached.series.map((p) => ({ date: p.date, value: p.close }));
  } catch {
    return [];
  }
}

/**
 * Total return % for a benchmark over `range`. When `fromDate` is given, the
 * window starts at the first benchmark point on/after it — so a benchmark and a
 * portfolio can be compared over the *same* span. Returns `null` when there
 * isn't enough data.
 */
export async function getBenchmarkReturnPct(
  key: string,
  range: SeriesRange = "6mo",
  fromDate?: string,
): Promise<number | null> {
  const series = await getBenchmarkSeries(key, range);
  const pts = fromDate ? series.filter((p) => p.date >= fromDate) : series;
  if (pts.length < 2) return null;
  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  if (!first) return null;
  return (last / first - 1) * 100;
}
