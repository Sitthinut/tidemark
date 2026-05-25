# Roadmap

> **What's next — forward-looking intent only.** What already works is the
> [README status board](./README.md#status); shipped detail is in
> [CHANGELOG.md](./CHANGELOG.md). If a line here describes something already true
> in the running app, it belongs in one of those, not here.

**Vision.** An AI investment companion for Thai index investors — hold your
mutual-fund holdings, see allocation/fees/NAV trends honestly, and chat with an
advisor that has structured, read-and-propose access to your portfolio, plan,
and journal. Personal-use experiment, soft-public for family and friends.

The app is past its static-data prototype stage: persistence, AI chat with
advisor tool-calls, market data, portfolio import, long-term memory, and the
multi-user foundation have all shipped. What remains is finishing the
public-launch hardening and a short list of forward work, framed below as
**Now / Next / Later**.

## Out of scope (until a real need appears)

The cheapest way to keep this project focused — what it deliberately does *not*
do:

- **Open SaaS / billing / self-serve upgrade / admin web UI beyond tier
  toggling** — public sign-up defaults to free-tier; tier promotion is owner-
  driven.
- **Horizontal scaling / multi-region** — single VM, single SQLite writer; the
  trigger to change is migrating to Turso/Postgres, not layering on SQLite.
- **Enterprise SSO (SAML/OIDC), org/team accounts, magic-link email,
  billing/paywall, Apple OAuth** — add any only if a real user needs it.
- **Realtime collaborative editing** — index investing is single-owner,
  low-frequency; a sharing/roles model (`portfolio_members` with
  owner/editor/viewer) is the ceiling, and only if a concrete shared workflow
  appears.
- **Mobile-native app / PWA** — desktop / mobile web only.
- **Aesthetic overhaul** — handled inline, not as a stage of its own.

## Now — finish the public launch

**Goal:** open the app to family/friends via a public link. Each account is
isolated; the owner's OpenRouter budget is protected by per-user token caps and
free-tier-only access for new accounts. No transactional email.

The multi-user machinery is built and on `main`: per-user scoping (migrations
`0007`/`0008`), env-gated Google/GitHub OAuth, quotas + tier gating, the
Turnstile sign-up gate (bypassed when unset), and the account page. What's left
is launch readiness.

**Multi-tenant hardening status** (the public link means *anyone* can reach
signup, so data isolation is load-bearing):

1. **Fail-closed scoping — ✅ done.** `ownedBy()` is default-deny for logged-in
   users; built-ins opt in explicitly. See
   [lib/db/queries/scope.ts](./lib/db/queries/scope.ts).
2. **Per-user `plans` — ✅ done.** Migration `0008`; `getPlan`/`upsertPlan`
   scoped per user. See [lib/db/queries/plan.ts](./lib/db/queries/plan.ts).
3. **Owner admin surface — ✅ done.** An owner-only page (list users, flip
   `free`↔`trusted`) replacing manual `UPDATE account_tier` SQL — gated on
   `OWNER_EMAIL` and enforced server-side on every request, with a self-demote
   guard. Tier is read per request, so a change applies on the user's **next
   request**.
4. **Default posture — ✅ at code level.** New signups get `free` (own isolated
   data, free models only); the owner promotes to `trusted`. A "your account is
   pending an upgrade" affordance is a remaining nicety.

**Locked invariants for launch** (keep them tested):

- The `free` tier can **never** resolve to a non-free model regardless of
  `AI_MODELS` env — a config slip otherwise burns the budget.
- Every app route returns 401 without a session and only that user's rows with
  one. A leak test runs as user A and asserts zero rows for B.
- `OPENROUTER_API_KEY` never appears in browser-visible payloads.
- `PUBLIC_APP_URL` is pinned in production — changing it breaks passkey `rpID`
  and OAuth callback URIs.

## Next — durable data + freshness

Lower urgency than launch, but the obvious follow-ups once the door is open.

### Reliable market-data source (Yahoo 429s)

Indices + FX come from Yahoo's unauthenticated chart endpoint, which rate-
limits server-side requests (HTTP 429), often blanket-blocking a deploy's IP.
Mitigated so far — stale-on-error fallback, a per-symbol backoff, and a warmed
demo cache — so a warmed cache survives outages, but a cold start (or a
persistently-blocked IP) still shows "Market data is unavailable." Pick a more
durable path before relying on live indices in production. Options to weigh:

- A keyed provider with a real free tier (e.g. Alpha Vantage, Twelve Data,
  Finnhub) behind the existing `Provider` registry — most reliable, costs an
  API key + per-provider symbol mapping.
- Yahoo with proper cookie+crumb auth, or a more lenient endpoint — no key, but
  brittle and may still throttle.
- Lean on scheduled refresh (below) to populate the cache off one well-spaced
  job instead of per-request fetches, shrinking 429 exposure.

Thai fund NAVs already come from the SEC Open API (reliable) — this is only the
index/FX path.

### Scheduled NAV refresh

Today NAVs are fetched on-demand and cached (5-min quotes, 24h history). A
scheduled refresh would proactively pull after the Thai SEC's 17:30 Bangkok
window so charts are fresh without a user trigger. The fetching already works;
only the scheduling is missing. The `closeStaleSessions` memory backstop
(`npm run jobs:close-stale`) is the other job that wants a scheduler — its
primary close path is real-time, so this is just a safety sweep. Needs a
scheduler/cron decision. (Weekly digest email + push notifications →
[Later](#later--parked-until-a-real-need).)

## Later — parked until a real need

Deliberate "laters," revisited on real need rather than on a schedule:

- **Google + GitHub OAuth sign-in** — passkey-only login covers launch; social
  SSO is a convenience add. The code path is env-gated and already merged; flip
  it on by registering the OAuth apps + setting the client vars when a real user
  wants it.
- **Scheduled jobs: weekly digest email + push notifications** — needs a
  scheduler/cron decision and (for digests) email transport, which the project
  deliberately avoids. Scheduled **NAV refresh** stays a Next item above (cheap,
  useful even solo).
- **AI-generated market digest** ("Today, in your words" on the Markets
  screen) — a short, plain-language read of the day grounded in the user's
  actual holdings + live index/NAV data. The old card showed a hardcoded digest
  with fabricated portfolio figures, so it was removed; bring it back only when
  it's generated from real data (advisor + market signals).
- **Vector recall / offline memory consolidation** — current FTS-based recall
  is enough; revisit only if recall quality demands embeddings.
- **Broker scraping / unofficial APIs** — TOS + maintenance burden; only if a
  clear personal need emerges. No scraper lands without a discussion first.

## Why this build order

Easiest → hardest, lowest risk → highest risk: **persistence** (mechanical,
unlocks everything) → **AI chat** (highest user value) → **market data**
(moderate plumbing) → **portfolio import** (hardest; unreliable data sources) →
**multi-user** (only needed before sharing a deployment). Aesthetics come last
and inline, not as a stage of their own — real data exposes the gaps worth
polishing.

## References

This doc is intent only. The neighbours that hold the rest:

- **What works today** → [README status board](./README.md#status).
- **What shipped** → [CHANGELOG.md](./CHANGELOG.md) (by capability).
- **Why we picked what we picked** →
  [docs/explanation/decisions/](./docs/explanation/decisions/) (the
  settled-decisions log / ADRs).
- **How to run it** → [docs/how-to/deploy.md](./docs/how-to/deploy.md)
  (localhost + single-owner self-host runbook).
- **Conventions for touching code** → [AGENTS.md](./AGENTS.md).
- **Feature designs** → `docs/` (Diátaxis: `tutorials/`, `how-to/`,
  `reference/`, `explanation/`), one file per feature.

## Doc stewardship

Stale docs are this project's #1 failure mode. Every code change that ships a
feature **must** include the matching doc update in the same commit.

| When you change… | Update… |
| --- | --- |
| Shipped a behavior change | [CHANGELOG.md](./CHANGELOG.md) `## [Unreleased]` (by capability) |
| A capability's shipped status | [README.md](./README.md#status) status board |
| Planned, unbuilt work | [ROADMAP.md](./ROADMAP.md) Now / Next / Later |
| A settled technical decision | [docs/explanation/decisions/](./docs/explanation/decisions/) |
| Env vars | [.env.example](.env.example) + [auth-and-providers.md](./docs/reference/auth-and-providers.md) + [deploy.md](./docs/how-to/deploy.md) + [AGENTS.md](./AGENTS.md) env table |
| Auth or security posture | [SECURITY.md](./SECURITY.md) + [auth-and-providers.md](./docs/reference/auth-and-providers.md) |
| Deployment topology | [deploy.md](./docs/how-to/deploy.md) |
| Conventions an agent must know | [AGENTS.md](./AGENTS.md) |
| External data source (provider, API) | feature doc under `docs/` + [SECURITY.md](./SECURITY.md) if it touches auth |

A doc reference to a function, env var, or file path is a contract: when you
rename/move/delete it, `grep -rn "thing" *.md docs/` and fix the references.
