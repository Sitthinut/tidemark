// Symbol → Provider routing.
//
// Providers are checked in registration order; the first one whose `matches`
// returns true wins. Order matters: more-specific providers should come
// before broader ones (Yahoo is the catch-all and ships last).

import { secThailandProvider } from "./providers/sec-thailand";
import type { Provider } from "./providers/types";
import { yahooProvider } from "./providers/yahoo";

// Order matters: more-specific (prefixed) providers first, broad
// matchers last. Yahoo accepts anything without a colon, so it must
// sit at the end of the list.
const providers: Provider[] = [secThailandProvider, yahooProvider];

/**
 * Register a provider at app boot. Idempotent on `id`. Providers added later
 * are inserted before the existing list, so a new prefixed provider (e.g.
 * `TH:`) wins against the broader Yahoo matcher.
 */
export function registerProvider(p: Provider): void {
  const idx = providers.findIndex((existing) => existing.id === p.id);
  if (idx >= 0) {
    providers[idx] = p;
    return;
  }
  providers.unshift(p);
}

export function resolveProvider(symbol: string): Provider {
  for (const p of providers) {
    if (p.matches(symbol)) return p;
  }
  throw new Error(`No provider matches symbol: ${symbol}`);
}

export function listProviders(): readonly Provider[] {
  return providers;
}
