// Suggestions for a holding's `source` label (where the holding is held — a
// brokerage/account). Free text, so these are only hints: the user's own
// previously-used sources first, then a few common Thai brokerages as starters.
// `source` is cosmetic — it does NOT affect pricing (that's `quoteSource`).

export const BROKERAGE_SUGGESTIONS = [
  "SCB Easy Invest",
  "Kasikorn (K-My Funds)",
  "Krungsri Asset",
  "BBLAM",
] as const;

/**
 * Distinct, trimmed source labels — the user's own (from existing holdings)
 * first, then the brokerage starters. Drives the source combobox's datalist.
 */
export function mergeSourceSuggestions(
  holdingSources: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...holdingSources, ...BROKERAGE_SUGGESTIONS]) {
    const v = raw?.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
