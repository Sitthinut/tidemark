// Thai SEC Open API provider — Thai mutual fund daily NAV.
//
// Source: official Securities and Exchange Commission of Thailand.
// Portal: https://secopendata.sec.or.th/sec-open-apis (launched 2026-01-12).
//   Old portal at https://api-portal.sec.or.th/ retires 2026-06-30.
//
// Auth: single subscription on the new portal gives you Primary + Secondary
// keys (rotation pair — both valid). One subscription covers all six product
// groups (/bond, /fund, /digital-asset, /LicenseCheck, /onereport, /pvd).
// Header: Ocp-Apim-Subscription-Key (Azure APIM standard).
//
// Rate limit: 5,000 calls per 300 seconds. Min ~16ms between requests
// recommended. HTTP 421 (not 429) signals over-limit; respect Retry-After.
// Refresh windows: 09:30 + 17:30 Bangkok time.
//
// Symbol format: "thfund:<proj_abbr_name>" (e.g. "thfund:EXAMPLE-FUND-A").
// The `thfund:` prefix names the ASSET CLASS (Thai mutual fund), not this
// provider — so holdings stay valid if we ever swap the underlying data
// source. The human-friendly abbr name resolves to a UUID-shaped proj_id
// via a cached lookup; the daily NAV endpoint takes proj_id, not the name.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │ MIGRATION TODO                                                       │
// │ The endpoint paths below target the LEGACY portal:                   │
// │   /FundFactsheet/fund/amc                                            │
// │   /FundFactsheet/fund/amc/{unique_id}                                │
// │   /FundDailyInfo/{proj_id}/dailynav/{date}                           │
// │ The new portal reorganized everything under /fund/* with cursor      │
// │ pagination (response wrapper: {message, page_size, next_cursor,      │
// │ items: [...]}). These legacy paths work until 2026-06-30 then die.   │
// │ Refresh against the new portal's Fund API product page before then.  │
// └──────────────────────────────────────────────────────────────────────┘
//
// Endpoints used:
//   GET /FundFactsheet/fund/amc                      → [{ unique_id, ... }]
//   GET /FundFactsheet/fund/amc/{unique_id}          → [{ proj_id, proj_abbr_name, fund_status, ... }]
//   GET /FundDailyInfo/{proj_id}/dailynav/{yyyy-MM-dd} → { last_val, nav_date, ... } or 204
//
// Status: Phase 3b experimental. The endpoint shapes were derived from
// a public reference implementation (Zummation/SEC-API); cross-check
// once a real subscription key is in hand and the first live call has
// been smoke-tested.

import {
  type Provider,
  ProviderError,
  type Quote,
  type SeriesInterval,
  type SeriesPoint,
  type SeriesRange,
} from "./types";

export const SEC_THAILAND_PREFIX = "thfund:";
const BASE_URL = "https://api.sec.or.th";
// Portal recommends ≥16ms between requests under the 5000-per-300s ceiling
// (≈16.6 req/sec headroom). We sleep 20ms to give ourselves margin while still
// finishing a 1-month NAV scan in under a second of wall time.
const REQUEST_DELAY_MS = 20;
const FUND_INDEX_TTL_MS = 24 * 60 * 60_000;

interface SecAmc {
  unique_id: string;
}

interface SecFund {
  proj_id: string;
  proj_abbr_name: string;
  proj_name_th?: string;
  proj_name_en?: string;
  fund_status?: string;
}

interface SecDailyNav {
  last_val: number;
  nav_date: string;
}

interface FundIndexEntry {
  projId: string;
  name: string;
}

type FundIndex = {
  byAbbr: Map<string, FundIndexEntry>;
  fetchedAt: number;
};

let fundIndexCache: FundIndex | null = null;
let fundIndexInflight: Promise<FundIndex> | null = null;

function apiKey(): string {
  const k = process.env.SEC_API_KEY;
  if (!k) {
    throw new ProviderError("SEC_API_KEY is not set", "sec-thailand");
  }
  return k;
}

async function secFetch<T>(path: string, key: string): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 204) return null; // No data for this date
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(
      `Thai SEC API rejected the subscription key (${res.status})`,
      "sec-thailand",
      res.status,
    );
  }
  // New portal returns 421 for over-rate-limit; legacy returns 429. Handle both.
  if (res.status === 421 || res.status === 429) {
    throw new ProviderError(
      `Thai SEC API rate-limited (${res.status})`,
      "sec-thailand",
      res.status,
    );
  }
  if (!res.ok) {
    throw new ProviderError(
      `Thai SEC API returned ${res.status} for ${path}`,
      "sec-thailand",
      res.status,
    );
  }
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function buildFundIndex(): Promise<FundIndex> {
  const key = apiKey();
  const amcs = (await secFetch<SecAmc[]>("/FundFactsheet/fund/amc", key)) ?? [];
  const byAbbr = new Map<string, FundIndexEntry>();
  for (const amc of amcs) {
    await sleep(REQUEST_DELAY_MS);
    const funds =
      (await secFetch<SecFund[]>(
        `/FundFactsheet/fund/amc/${encodeURIComponent(amc.unique_id)}`,
        key,
      )) ?? [];
    for (const f of funds) {
      if (!f.proj_id || !f.proj_abbr_name) continue;
      byAbbr.set(f.proj_abbr_name.toUpperCase(), {
        projId: f.proj_id,
        name: f.proj_name_en ?? f.proj_name_th ?? f.proj_abbr_name,
      });
    }
  }
  return { byAbbr, fetchedAt: Date.now() };
}

async function getFundIndex(): Promise<FundIndex> {
  if (fundIndexCache && Date.now() - fundIndexCache.fetchedAt < FUND_INDEX_TTL_MS) {
    return fundIndexCache;
  }
  if (fundIndexInflight) return fundIndexInflight;
  fundIndexInflight = buildFundIndex()
    .then((idx) => {
      fundIndexCache = idx;
      return idx;
    })
    .finally(() => {
      fundIndexInflight = null;
    });
  return fundIndexInflight;
}

function parseSymbol(symbol: string): string {
  if (!symbol.startsWith(SEC_THAILAND_PREFIX)) {
    throw new ProviderError(
      `Expected symbol to start with "${SEC_THAILAND_PREFIX}", got "${symbol}"`,
      "sec-thailand",
    );
  }
  return symbol.slice(SEC_THAILAND_PREFIX.length).toUpperCase();
}

function rangeToDays(range: SeriesRange): number {
  switch (range) {
    case "1mo":
      return 31;
    case "3mo":
      return 92;
    case "6mo":
      return 183;
    case "1y":
      return 366;
    case "5y":
      return 5 * 366;
    case "max":
      return 365 * 20;
  }
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchNavOnDate(
  projId: string,
  date: string,
  key: string,
): Promise<SecDailyNav | null> {
  return secFetch<SecDailyNav>(
    `/FundDailyInfo/${encodeURIComponent(projId)}/dailynav/${date}`,
    key,
  );
}

export const secThailandProvider: Provider = {
  id: "sec-thailand",
  matches(symbol: string): boolean {
    return symbol.startsWith(SEC_THAILAND_PREFIX);
  },
  async fetchSeries(
    symbol: string,
    range: SeriesRange,
    _interval: SeriesInterval,
  ): Promise<{ quote: Quote; series: SeriesPoint[] }> {
    const abbr = parseSymbol(symbol);
    const index = await getFundIndex();
    const entry = index.byAbbr.get(abbr);
    if (!entry) {
      throw new ProviderError(
        `Unknown Thai fund code "${abbr}" — not present in SEC FundFactsheet index`,
        "sec-thailand",
      );
    }

    const key = apiKey();
    const days = rangeToDays(range);
    const series: SeriesPoint[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = days; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const date = yyyyMmDd(d);
      const nav = await fetchNavOnDate(entry.projId, date, key);
      if (nav?.last_val != null) {
        series.push({ t: Math.floor(d.getTime() / 1000), close: nav.last_val });
      }
      await sleep(REQUEST_DELAY_MS);
    }

    if (series.length === 0) {
      throw new ProviderError(
        `No NAV data returned for ${symbol} over the requested range`,
        "sec-thailand",
      );
    }

    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : latest;
    const quote: Quote = {
      symbol,
      name: entry.name,
      currency: "THB",
      price: latest.close,
      previousClose: previous.close,
      asOfUnix: latest.t,
    };
    return { quote, series };
  },
};

/** Test-only — reset the fund-index cache. */
export function __resetSecThailandCache(): void {
  fundIndexCache = null;
  fundIndexInflight = null;
}
