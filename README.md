# Macrotide

> An open-source AI investment companion for Thai index investors. Personal-use
> experiment.

## Status

**Experimental.** The 7-screen UI (Portfolio, Markets, Chat, Journal, Models,
Connect, Settings) is responsive across mobile / tablet / desktop with
light/dark/system themes. Persistence (SQLite + Drizzle), chat with reload-
survives history (Vercel AI SDK via OpenRouter), plan-edit Apply that round-
trips through the API, passkey auth, and live market indices are all wired
up. Thai mutual-fund NAVs, news, and ANALYSIS scores are still placeholders
pending Phase 3b and Phase 6. See [ROADMAP.md](./ROADMAP.md) for the full
status board.

Don't rely on it for real investment decisions.

## What it will do

- Hold your **mutual fund holdings** (Thai fund-supermarket account).
- **Visualize** allocation, fees, and NAV trends.
- Fetch a **market view** from free public sources (SET index, public fund
  pages).
- Let you **jot thoughts and chat with an AI** that has structured access to
  your portfolio, plan, and journal — including AI-proposed plan edits you
  accept or reject as cards.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript 5
- Hand-rolled CSS — design tokens, light/dark/system themes (no Tailwind)
- Hand-rolled SVG charts
- [Biome](https://biomejs.dev/) for lint and format; [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks)
  with [lint-staged](https://github.com/lint-staged/lint-staged) for pre-commit
- SQLite + [Drizzle ORM](https://orm.drizzle.team/) for persistence; per-session
  in-memory SQLite for the demo mode
- [Vercel AI SDK](https://sdk.vercel.ai/) via [OpenRouter](https://openrouter.ai/)
  for chat (one key, every major model)
- [better-auth](https://www.better-auth.com/) + passkeys for sign-in — see
  [AUTH.md](./AUTH.md), [SECURITY.md](./SECURITY.md), [DEPLOY.md](./DEPLOY.md), [ROADMAP.md](./ROADMAP.md), [AGENTS.md](./AGENTS.md)

## Quick start

```bash
git clone <repo-url> macrotide
cd macrotide
npm install
npm run dev
```

Open <http://localhost:3000>. A fresh boot lands on `/login`; click
**Try the demo** to spin up an isolated in-memory SQLite seeded with mock
data (capped at 10 chat turns). For solo localhost dev, copy `.env.example`
to `.env.local` and set `AUTH_DISABLED=1` to skip the login screen — see
[AUTH.md](./AUTH.md). Chat returns a friendly stub until you set
`OPENROUTER_API_KEY`.

Scripts:

```bash
npm run dev        # dev server (hot reload)
npm run build      # production build
npm run start      # serve production build
npm run lint       # Biome check
npm run format     # Biome check --write
npm run typecheck  # tsc --noEmit
```

## Project layout

```text
macrotide/
├── app/
│   ├── (auth)/login/        Passkey sign-in screen
│   ├── api/                 Route handlers: buckets, holdings, journal, plan,
│   │                        models, quotes, settings, chat (+threads),
│   │                        market, demo, auth/[...all], admin
│   ├── layout.tsx, page.tsx, error.tsx, globals.css
├── components/
│   ├── screens/             Portfolio, Markets, Chat, Journal, Models,
│   │                        Connect, Settings
│   ├── App.tsx, ClientApp.tsx, AppPanels.tsx, charts.tsx, *Sheet.tsx, …
├── lib/
│   ├── ai/                  OpenRouter provider + chat plumbing
│   ├── api/                 Rate-limit + with-db helpers for route handlers
│   ├── auth/                better-auth singleton + session helpers
│   ├── db/                  Drizzle client, schema, migrations, queries,
│   │                        per-session demo SQLite, daily backup
│   ├── fetchers/            SWR fetchers (client-side data layer)
│   ├── market/              Yahoo client + cache + indices
│   ├── mock/                Seed data + demo seed (used by db:seed)
│   ├── portfolio/           Allocation/concentration analytics, plan parser,
│   │                        plan-edit helper
│   ├── static/              Editorial content (markets/learn/personalities)
│   │                        and placeholder analytics
│   ├── format.ts, useViewport.ts, useScrollHide.ts
├── data/                    SQLite + daily backups (gitignored)
├── tests/                   Vitest
├── AUTH.md, DEPLOY.md, SECURITY.md, ROADMAP.md, AGENTS.md, README.md
```

## Contributing

This is an experimental personal project. PRs and issues are welcome but
expect slow / opinionated responses. If you're picking up Phase 1, 2, 3, or
4 from the roadmap, open an issue first so we don't duplicate work.

## License

[MIT](./LICENSE)
