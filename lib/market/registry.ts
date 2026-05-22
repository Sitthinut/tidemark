// (source, ticker) → Provider routing.
//
// Providers are checked in registration order; the first one whose `matches`
// returns true wins. Providers shipped with the app:
//   - "thai_mutual_fund"  → sec-thailand (Thai SEC Open API)
//   - "yahoo"             → yahoo (broad catch-all for stocks/indices/FX)
//
// Add a new asset class by introducing a new quote_source value (see
// lib/market/sources.ts), implementing a Provider that matches it, and
// calling registerProvider() at module load. The provider order ensures
// more-specific sources are tried before broader ones.

import { secThailandProvider } from "./providers/sec-thailand";
import type { Provider } from "./providers/types";
import { yahooProvider } from "./providers/yahoo";

const providers: Provider[] = [secThailandProvider, yahooProvider];

/**
 * Register a provider at app boot. Idempotent on `id`. Providers added later
 * are inserted at the front of the list.
 */
export function registerProvider(p: Provider): void {
  const idx = providers.findIndex((existing) => existing.id === p.id);
  if (idx >= 0) {
    providers[idx] = p;
    return;
  }
  providers.unshift(p);
}

export function resolveProvider(source: string, ticker: string): Provider {
  for (const p of providers) {
    if (p.matches(source, ticker)) return p;
  }
  throw new Error(`No provider matches source="${source}", ticker="${ticker}"`);
}

export function listProviders(): readonly Provider[] {
  return providers;
}
