# Data model

Macrotide stores everything in a single SQLite database via Drizzle ORM. The
schema is defined in [lib/db/schema.ts](../../lib/db/schema.ts) — **that file is
the source of truth**; this page is an orientation map. Migrations live in
`lib/db/migrations/` and run automatically on boot.

## Tables at a glance

### Application data

| Table | Holds | Key columns / notes |
|---|---|---|
| `buckets` | Portfolio slices (Core, SSF, experiment, …) | `target_allocation` (JSON), `target_model_id`, `user_id` |
| `holdings` | Fund positions inside a bucket | `bucket_id` (FK, cascade), `units`, `avg_cost`, `ter`, `quote_source` (routing key) |
| `plans` | The investment plan | Single-row in v1; `markdown`, `selected_model_id`, `user_id` |
| `journal_entries` | Notes, decisions, questions, reading | `kind`, `tags` (JSON), `pinned`, `archived_at`, `user_id` |
| `model_portfolios` | Built-in + custom model allocations | `built_in`, `allocation` (JSON slices), risk/return metadata, `user_id` |
| `settings` | Generic key-value app settings | `key` → `value` (JSON) |

### Market cache (written by the market layer)

| Table | Holds | Key columns / notes |
|---|---|---|
| `fund_quotes` | Latest NAV + performance per ticker | `ticker` PK, `nav`, `d1_pct`, `ytd_pct`, `y1_pct` |
| `nav_history` | Daily NAV history | Composite PK (`ticker`, `date`) |

> Cache keys in `fund_quotes`/`nav_history` are the combined `${source}:${ticker}`
> so one table holds quotes from different providers without a schema change.
> See [AGENTS.md § Provider routing](../../AGENTS.md#provider-routing-via-holdingsquote_source).

### Chat & memory

| Table | Holds | Key columns / notes |
|---|---|---|
| `chat_threads` | One row per conversation | `status` (`active`/`idle`/`archived`), `archived_at`, `deleted_at` (30-day trash), `extracted_through_id` (extraction watermark) |
| `chat_messages` | Turns within a thread | `thread_id` (FK, cascade), `role`, `content`, `tool_call_id`, `feedback` |
| `user_preferences` | Long-term memory | **Bitemporal** — see below |

The `user_preferences` table is bitemporal: an update inserts a new row and
end-dates the old one (`valid_until`), never mutating in place; the active set
is `WHERE valid_until IS NULL`. Columns include `category` (enum:
`profile`/`finance_context`/`response_style`/`fact`), `source`
(`user_tool`/`advisor_tool`/`extracted`), `confidence`, and provenance
(`source_session_id`, `source_turn_ids`). Full design:
[features/memory.md](../explanation/memory.md).

### Auth (better-auth)

`user`, `session`, `account`, `verification`, and `passkey`. Names match
better-auth's defaults so its Drizzle adapter resolves them without a mapping.
These timestamps are stored as integer epoch-ms (app tables use ISO-8601 text).

### Multi-user metering

| Table | Holds | Key columns / notes |
|---|---|---|
| `usage` | Per-user daily token usage | Composite PK (`user_id`, `date`); `input_tokens`, `output_tokens` |
| `account_tier` | Per-user tier gating | `tier` (`free`/`trusted`); free is pinned to the free model chain in code |

## Ownership & multi-user

Most app tables carry a nullable `user_id` referencing `user.id`. Today, in
single-owner mode, it is `NULL` and rows are visible to the owner; multi-user
mode scopes every query by `user_id`. The evolution is described in
[design principles § single-owner → multi-user](../explanation/design-principles.md#from-single-owner-to-multi-user)
and the migration/backfill steps live in [ROADMAP.md](../../ROADMAP.md).

## Relationships (sketch)

```text
user ──< buckets ──< holdings
user ──< plans
user ──< journal_entries
user ──< model_portfolios
user ──< chat_threads ──< chat_messages
                       └─ user_preferences.source_session_id (provenance)
user ──< usage
user ──1 account_tier
holdings.quote_source ──▶ market registry ──▶ fund_quotes / nav_history
```
