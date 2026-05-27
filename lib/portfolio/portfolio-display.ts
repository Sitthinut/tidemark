// Display transform for a fund's full portfolio (fund_portfolio rows).
//
// The SEC /outstanding/portfolio feed itemizes every line as its own row, with
// no de-duplication. Two failure modes drown the real holdings:
//   1. A currency-hedged feeder fund (e.g. K-US500X) holds one master ETF plus a
//      ladder of dozens of FX-forward contracts — each an anonymous row (no
//      issuer, no ISIN).
//   2. A money-market / bond fund (e.g. TCMF-M) holds the same security split
//      across dozens of tranches — 47 promissory notes from one issuer, each a
//      separate NAMED row with identical issuer + description.
// Both render as a wall of near-identical lines. We collapse rows that share an
// identity (ISIN if present, else issuer + description) into one net row,
// summing %NAV, and keep single-member identities as individual lines (a
// feeder's single master ETF must stay one normal row).
//
// Pure + framework-free so it can be unit-tested without React.

import type { FundPortfolioRow } from "@/lib/db/queries/fund-enrichment";

export interface PortfolioDisplayRow {
  /** Stable React key. */
  key: string;
  /** Primary label — instrument description, falling back to issuer. */
  label: string;
  /** Secondary line (issuer). Null for collapsed groups. */
  issuer: string | null;
  isin: string | null;
  percentNav: number | null;
  /** Underlying rows when this is a collapsed group (>1 member); else undefined. */
  members?: FundPortfolioRow[];
}

/** A row identifies a specific security when it carries an issuer or an ISIN. */
function hasIdentity(row: FundPortfolioRow): boolean {
  return Boolean(row.issuer?.trim() || row.isinCode?.trim());
}

/**
 * Identity key used to collapse duplicate line-items. Prefer ISIN (a globally
 * unique security id); otherwise fall back to issuer + instrument description so
 * the dozens of "PN Term" notes from a single issuer fold into one row. Anonymous
 * rows (no issuer/ISIN — FX forwards) group by their description alone.
 */
function identityKey(row: FundPortfolioRow): string {
  const isin = row.isinCode?.trim();
  if (isin) return `isin:${isin}`;
  if (hasIdentity(row)) {
    const issuer = row.issuer?.trim() ?? "";
    const desc = row.assetliabDesc?.trim() ?? "";
    return `id:${issuer}|${desc}`;
  }
  return `anon:${row.assetliabDesc ?? row.assetliabId ?? "อื่นๆ"}`;
}

/** Best label for a group — instrument description, falling back to issuer. */
function groupLabel(first: FundPortfolioRow): string {
  return first.assetliabDesc ?? first.issuer ?? "—";
}

/**
 * Build display rows from raw portfolio rows: every row is grouped by an identity
 * key (ISIN, else issuer + description, else description for anonymous rows).
 * Single-member identities pass through as individual lines; any identity with
 * more than one member collapses into one net row (label "<desc> (net · N)")
 * summing %NAV, with its members attached for inline expansion. Sorted by weight
 * descending so the real holdings lead and net hedges sink.
 */
export function buildPortfolioDisplayRows(rows: FundPortfolioRow[]): PortfolioDisplayRow[] {
  const groups = new Map<string, FundPortfolioRow[]>();
  // Preserve first-seen order of keys so deterministic ties keep input order.
  for (const row of rows) {
    const key = identityKey(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const display: PortfolioDisplayRow[] = [];
  for (const [key, members] of groups) {
    const first = members[0];
    const multi = members.length > 1;
    const named = hasIdentity(first);
    if (!multi) {
      // Single line — render as-is, keeping its identity (issuer/ISIN) intact.
      display.push({
        key: named ? `n-${first.id}` : `g-${key}`,
        label: named ? (first.assetliabDesc ?? first.issuer ?? "—") : groupLabel(first),
        issuer: named ? (first.issuer ?? null) : null,
        isin: named ? (first.isinCode ?? null) : null,
        percentNav: first.percentNav ?? null,
      });
      continue;
    }
    // Collapsed net row across the group's members.
    const sum = members.reduce((acc, m) => acc + (m.percentNav ?? 0), 0);
    display.push({
      key: `g-${key}`,
      label: `${groupLabel(first)} (net · ${members.length})`,
      // Surface the shared issuer/ISIN on a named collapse so the row still
      // reads as a real security, not an anonymous bucket.
      issuer: named ? (first.issuer ?? null) : null,
      isin: named ? (first.isinCode ?? null) : null,
      percentNav: sum,
      members,
    });
  }

  return display.sort(
    (a, b) =>
      (b.percentNav ?? Number.NEGATIVE_INFINITY) - (a.percentNav ?? Number.NEGATIVE_INFINITY),
  );
}
