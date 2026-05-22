import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { listFundQuotes } from "@/lib/db/queries/quotes";
import { getCachedSeries } from "@/lib/market/cache";

interface QuoteResult {
  symbol: string;
  ok: boolean;
  price?: number;
  previousClose?: number;
  asOf?: string;
  error?: string;
}

/**
 * GET /api/quotes?tickers=A,B,C
 *   Return cached fund_quotes rows for the requested tickers (read-only).
 *
 * GET /api/quotes?tickers=A,B,C&refresh=1
 *   Refresh each ticker through its provider (Yahoo / Thai SEC / …) and
 *   return normalized quote+freshness payload. Cache misses trigger a
 *   network call; cache hits (<24h history TTL) are served from the DB.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get("tickers");
  const refresh = url.searchParams.get("refresh") === "1";
  const tickers = tickersParam
    ? tickersParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  if (!refresh) {
    return withDb(() => NextResponse.json(listFundQuotes(tickers)));
  }

  if (!tickers || tickers.length === 0) {
    return NextResponse.json({ error: "tickers query parameter required" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    tickers.map(async (symbol): Promise<QuoteResult> => {
      const cached = await getCachedSeries(symbol, "6mo", "1d");
      if (!cached.quote) {
        return { symbol, ok: false, error: "no data" };
      }
      return {
        symbol,
        ok: true,
        price: cached.quote.price,
        previousClose: cached.quote.previousClose,
        asOf: cached.quote.asOf,
      };
    }),
  );

  const payload: QuoteResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      symbol: tickers[i],
      ok: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  return NextResponse.json(payload);
}
