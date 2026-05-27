// iShares ETF holdings provider — fetches the master fund's daily published
// holdings CSV from BlackRock/iShares public download URLs.
//
// Source: BlackRock iShares public product pages (no auth required).
// Each iShares ETF product page exposes a stable "Download CSV" link for its
// current holdings. The URL pattern is:
//
//   https://www.ishares.com/us/products/{productId}/#tabsAll
//   Holdings CSV download:
//   https://www.ishares.com/us/products/{productId}/ishares-{slug}/1467271812596.ajax
//     ?tab=holdings&fileType=csv
//
// The canonical stable per-product URL is discoverable from the iShares product
// page. We normalise a predictable URL from a numeric product id + slug.
//
// CSV format (after two header rows):
//   Name, Ticker, Asset Class, Market Value, Weight (%), Notional Value,
//   Shares, CUSIP, ISIN, Exchange, Currency, FX Rate, Market Currency,
//   Market Value (local), Notional Value (local), Price, Duration, Maturity
//   (first two rows are metadata: "Fund Holdings as of", "Inception Date")
//
// Free source — no authentication, no sign-up required. BlackRock serves
// these CSVs publicly for transparency / regulatory disclosure.
//
// Rate-limiting: be polite. Default: one request per product per crawl run.
// No retry needed — network errors bubble up as empty arrays.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single holding row parsed from an iShares holdings CSV. */
export interface ISharesHoldingRow {
  /** Security name as published by iShares. */
  name: string;
  /** Ticker symbol, may be empty for bonds/cash. */
  ticker: string;
  /** Asset class label from iShares (Equity, Fixed Income, Cash, etc.). */
  assetClass: string;
  /** ISIN code, may be empty. */
  isin: string;
  /** Weight (%) as a fraction — e.g. 7.23 means 7.23% of fund NAV. */
  weightPct: number | null;
  /** Market value in USD (fund's base currency). */
  marketValue: number | null;
  /** Number of shares/units held. */
  shares: number | null;
  /** The "as of" date for this holdings snapshot (ISO date string YYYY-MM-DD). */
  asOfDate: string;
}

/** Minimal identifier to locate an iShares product. */
export interface ISharesProductRef {
  /** The numeric product id in the iShares URL
   *  e.g. "239726" for IVV (iShares Core S&P 500 ETF). */
  productId: string;
  /** URL slug, used only for the download URL.
   *  e.g. "ishares-core-sp-500-etf" for IVV. */
  slug: string;
  /** Distinctive index identifier that MUST appear (case-insensitive substring)
   *  in a master-fund name for this product to be a match candidate. Primary
   *  keywords are disjoint across asset classes (e.g. "s&p 500" vs "msci world"
   *  vs "nasdaq"), so a name can never be a candidate for two different asset
   *  classes — this is what makes cross-asset mis-matches impossible. Optional
   *  on the type so ad-hoc refs (e.g. for buildCsvUrl) need not supply it, but
   *  every ISHARES_PRODUCTS entry must (enforced by the registry test). */
  primaryKeyword?: string;
  /** Extra disambiguating keywords (e.g. "ucits") used only to break ties
   *  between same-asset-class products (UCITS vs US-listed variants). */
  keywords?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.ishares.com";
// Stable Ajax timestamp found in all iShares CSV download URLs.
const CSV_AJAX_KEY = "1467271812596";
// A current desktop Chrome UA. iShares' CDN serves these public holdings CSVs
// to browser-shaped clients; a real UA avoids occasional default-UA blocks.
// Servers don't check UA freshness, so a slightly old version still works —
// refresh this string once a year or so; no need to auto-bump.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

// ─── Well-known product registry ─────────────────────────────────────────────
// A curated subset of iShares ETFs commonly used as master funds by Thai
// feeder funds. Keyed by ISIN for reliable cross-referencing with SEC data.
// Add entries here as new feeder funds are mapped.
// Sources: iShares product pages (no-auth, public).
export const ISHARES_PRODUCTS: Record<string, ISharesProductRef> = {
  // S&P 500
  IE00B5BMR087: {
    productId: "251656",
    slug: "ishares-core-sp-500-ucits-etf",
    primaryKeyword: "s&p 500",
    keywords: ["ucits"],
  }, // CSPX (LSE)
  US4642872265: { productId: "239726", slug: "ishares-core-sp-500-etf", primaryKeyword: "s&p 500" }, // IVV (NYSE)
  // MSCI World
  IE00B4L5Y983: {
    productId: "251850",
    slug: "ishares-core-msci-world-ucits-etf",
    primaryKeyword: "msci world",
    keywords: ["ucits"],
  }, // IWDA (LSE)
  // MSCI EM
  IE00B4L5YC18: {
    productId: "264659",
    slug: "ishares-core-msci-emerging-markets-imi-ucits-etf",
    primaryKeyword: "emerging market",
    keywords: ["ucits", "imi"],
  }, // EIMI (LSE)
  // NASDAQ-100
  IE00B53SZB19: {
    productId: "253741",
    slug: "ishares-nasdaq-100-ucits-etf",
    primaryKeyword: "nasdaq",
    keywords: ["ucits"],
  }, // CNDX (LSE)
  US46435G4701: { productId: "239599", slug: "ishares-nasdaq-100-etf", primaryKeyword: "nasdaq" }, // IQQQ / QQQ proxy
  // Short-duration corporate bonds
  US4642874329: {
    productId: "239454",
    slug: "ishares-short-term-corporate-bond-etf",
    primaryKeyword: "corporate bond",
    keywords: ["short"],
  }, // IGSB
  // Global REIT
  IE00B1FZSF77: {
    productId: "258642",
    slug: "ishares-developed-world-property-yield-ucits-etf",
    primaryKeyword: "property",
    keywords: ["developed world"],
  }, // IWDP
};

/**
 * Resolve a master-fund name string (the SEC `feederfund_master_fund` field) to
 * a registry ISIN, conservatively. A product is a candidate only if the name
 * contains its `primaryKeyword`; the winner is the unique highest-scoring
 * candidate (score = primary + matched `keywords`). Returns null when there is
 * no candidate OR when the top score is tied — callers should then fall back to
 * an explicit `feeder_master_map` entry rather than guess.
 *
 * Because primary keywords are disjoint across asset classes, this can never
 * map (say) an MSCI World feeder to an S&P 500 ETF; ties only occur between
 * same-asset variants (e.g. UCITS vs US-listed), where skipping is the safe
 * choice.
 */
export function matchISharesMaster(masterName: string): string | null {
  const name = masterName.toLowerCase();
  let best: { isin: string; score: number } | null = null;
  let tied = false;
  for (const [isin, ref] of Object.entries(ISHARES_PRODUCTS)) {
    if (!ref.primaryKeyword || !name.includes(ref.primaryKeyword.toLowerCase())) continue;
    const extra = ref.keywords?.filter((k) => name.includes(k.toLowerCase())).length ?? 0;
    const score = 1 + extra;
    if (!best || score > best.score) {
      best = { isin, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied ? best.isin : null;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Build the holdings-CSV download URL for a given iShares product.
 * The URL follows the stable pattern used across all iShares product pages.
 */
export function buildCsvUrl(ref: ISharesProductRef): string {
  return (
    `${BASE_URL}/us/products/${ref.productId}/` +
    `${ref.slug}/${CSV_AJAX_KEY}.ajax?tab=holdings&fileType=csv`
  );
}

/**
 * Fetch and parse an iShares holdings CSV by product ref.
 *
 * Returns an empty array (never throws) when:
 *  - network is unreachable
 *  - HTTP error response
 *  - CSV is empty or has unexpected format
 *
 * Only throws ISharesProviderError for unexpected non-network failures
 * that indicate a programming error (bad productRef shape, etc.).
 */
export async function fetchISharesHoldings(ref: ISharesProductRef): Promise<ISharesHoldingRow[]> {
  const url = buildCsvUrl(ref);
  let text: string;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": BROWSER_USER_AGENT,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      // Return empty — server may return 404 when a product is delisted,
      // or 403 during maintenance. Don't abort the crawl.
      return [];
    }
    text = await res.text();
  } catch {
    // Network error — return empty.
    return [];
  }

  return parseISharesCsv(text);
}

/**
 * Fetch iShares holdings by ISIN. Looks up the product ref in the built-in
 * registry. Returns an empty array when the ISIN is not in the registry or
 * the fetch fails.
 */
export async function fetchISharesHoldingsByIsin(isin: string): Promise<ISharesHoldingRow[]> {
  const ref = ISHARES_PRODUCTS[isin.trim().toUpperCase()];
  if (!ref) return [];
  return fetchISharesHoldings(ref);
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Parse an iShares holdings CSV string.
 *
 * The iShares CSV format:
 *   Row 1: "Fund Holdings as of","<date>",...
 *   Row 2: "Inception Date","<date>",...
 *   Row 3: column headers
 *   Row 4+: data rows, terminated by a trailing empty row or footer
 *
 * Columns (0-indexed):
 *   0  Name
 *   1  Ticker
 *   2  Asset Class
 *   3  Market Value   (USD, formatted with commas, may be "-")
 *   4  Weight (%)     (e.g. "7.23", may be "-")
 *   5  Notional Value
 *   6  Shares         (may be "-")
 *   7  CUSIP
 *   8  ISIN
 *   ...
 */
export function parseISharesCsv(csv: string): ISharesHoldingRow[] {
  if (!csv || csv.trim().length === 0) return [];

  const lines = csv.split("\n").map((l) => l.trimEnd());
  if (lines.length < 4) return [];

  // Row 0: "Fund Holdings as of","YYYY-MM-DD",... (or "Month DD, YYYY")
  const asOfDate = extractAsOfDate(lines[0]);

  // Row 2: column headers
  const headerLine = lines[2];
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

  // Locate column indices by header name (tolerant of extra columns).
  const col = (name: string) => headers.indexOf(name);
  const nameIdx = col("name");
  const tickerIdx = col("ticker");
  const assetClassIdx = col("asset class");
  const marketValueIdx = col("market value");
  const weightIdx = col("weight (%)");
  const sharesIdx = col("shares");
  const isinIdx = col("isin");

  // Require at minimum: name + weight.
  if (nameIdx < 0 || weightIdx < 0) return [];

  const rows: ISharesHoldingRow[] = [];

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") break; // trailing blank line = end of data

    const cells = parseCsvLine(line);
    const name = cells[nameIdx]?.trim() ?? "";
    if (
      !name ||
      name.startsWith('"Fund Holdings') ||
      name.toLowerCase().startsWith("fund holdings")
    ) {
      continue; // skip footer/header repetition rows
    }

    const ticker = tickerIdx >= 0 ? (cells[tickerIdx]?.trim() ?? "") : "";
    const assetClass = assetClassIdx >= 0 ? (cells[assetClassIdx]?.trim() ?? "") : "";
    const isin = isinIdx >= 0 ? (cells[isinIdx]?.trim() ?? "") : "";
    const weightPct = parseNumericCell(weightIdx >= 0 ? cells[weightIdx] : undefined);
    const marketValue = parseNumericCell(marketValueIdx >= 0 ? cells[marketValueIdx] : undefined);
    const shares = parseNumericCell(sharesIdx >= 0 ? cells[sharesIdx] : undefined);

    // Skip obvious total/cash rows that contaminate the holdings list.
    if (assetClass.toLowerCase() === "cash" && !ticker && !isin) continue;

    rows.push({
      name,
      ticker,
      assetClass,
      isin,
      weightPct,
      marketValue,
      shares,
      asOfDate,
    });
  }

  // Sort by weight descending (largest holdings first).
  rows.sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0));

  return rows;
}

// ─── Parsing utilities ────────────────────────────────────────────────────────

/**
 * Parse one CSV line, handling quoted fields that may contain commas.
 * Simple RFC 4180-compatible parser — no escape sequences beyond double-quote.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field.
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a numeric cell value (may have commas, leading $, trailing spaces,
 * or be "-" / "--" / empty for missing). Returns null on non-numeric values.
 */
function parseNumericCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/[$,]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "--" || cleaned === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract the "as of" date from the first row of an iShares CSV.
 * The row looks like: "Fund Holdings as of","May 23, 2026",...
 * Returns an ISO date string (YYYY-MM-DD) or "unknown" if parsing fails.
 */
function extractAsOfDate(firstRow: string): string {
  const cells = parseCsvLine(firstRow);
  const raw = cells[1]?.trim() ?? "";
  if (!raw) return "unknown";

  // Try ISO format first: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Try "Month DD, YYYY" format: e.g. "May 23, 2026"
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return raw; // return raw if we can't parse
}

/** Expose for testing only. */
export function __buildCsvUrlForTest(ref: ISharesProductRef): string {
  return buildCsvUrl(ref);
}
