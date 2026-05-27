// Display transform for a fund's full portfolio (fund_portfolio rows).
//
// The SEC /outstanding/portfolio feed itemizes every derivative contract as its
// own line. A currency-hedged feeder fund (e.g. K-US500X) holds one master ETF
// plus a ladder of dozens of FX-forward contracts — each a separate row with no
// issuer and no ISIN. Listing 60 near-zero forwards drowns the real holdings, so
// we collapse those anonymous rows (no issuer, no ISIN) into one net row per
// instrument description, keeping named securities (stocks, the master ETF, bank
// deposits — all of which carry an issuer or ISIN) as individual lines.
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
 * Build display rows from raw portfolio rows: named securities pass through
 * individually; anonymous rows (no issuer/ISIN — i.e. derivatives like FX
 * forwards) are grouped by their description and summed into one net row.
 * Sorted by weight descending so the real holdings lead and net hedges sink.
 */
export function buildPortfolioDisplayRows(rows: FundPortfolioRow[]): PortfolioDisplayRow[] {
  const named: PortfolioDisplayRow[] = [];
  const anonGroups = new Map<string, FundPortfolioRow[]>();

  for (const row of rows) {
    if (hasIdentity(row)) {
      named.push({
        key: `n-${row.id}`,
        label: row.assetliabDesc ?? row.issuer ?? "—",
        issuer: row.issuer ?? null,
        isin: row.isinCode ?? null,
        percentNav: row.percentNav ?? null,
      });
    } else {
      const groupKey = row.assetliabDesc ?? row.assetliabId ?? "อื่นๆ";
      const bucket = anonGroups.get(groupKey);
      if (bucket) bucket.push(row);
      else anonGroups.set(groupKey, [row]);
    }
  }

  const collapsed: PortfolioDisplayRow[] = [];
  for (const [desc, members] of anonGroups) {
    const sum = members.reduce((acc, m) => acc + (m.percentNav ?? 0), 0);
    const multi = members.length > 1;
    collapsed.push({
      key: `g-${desc}`,
      label: multi ? `${desc} (net · ${members.length})` : desc,
      issuer: null,
      isin: null,
      percentNav: sum,
      members: multi ? members : undefined,
    });
  }

  return [...named, ...collapsed].sort(
    (a, b) =>
      (b.percentNav ?? Number.NEGATIVE_INFINITY) - (a.percentNav ?? Number.NEGATIVE_INFINITY),
  );
}
