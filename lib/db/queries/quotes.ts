import { inArray } from "drizzle-orm";
import { getMarketDb } from "../context";
import { fundQuotes } from "../schema";

export type FundQuote = typeof fundQuotes.$inferSelect;
export type FundQuoteInsert = typeof fundQuotes.$inferInsert;

export function listFundQuotes(tickers?: string[]): FundQuote[] {
  const q = getMarketDb().select().from(fundQuotes);
  return (tickers && tickers.length ? q.where(inArray(fundQuotes.ticker, tickers)) : q).all();
}

export function upsertFundQuote(input: FundQuoteInsert): FundQuote {
  return getMarketDb()
    .insert(fundQuotes)
    .values(input)
    .onConflictDoUpdate({
      target: fundQuotes.ticker,
      set: {
        nav: input.nav,
        d1Pct: input.d1Pct,
        ytdPct: input.ytdPct,
        y1Pct: input.y1Pct,
        updatedAt: input.updatedAt,
      },
    })
    .returning()
    .get();
}
