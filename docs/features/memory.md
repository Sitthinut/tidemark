# Memory

Macrotide remembers what you tell it across chats — your goals, risk
tolerance, accounts, response preferences — so you don't have to re-explain
yourself every time. Memory is **visible** (you can see and edit everything
on the Settings → Memory page), **bitemporal** (changes over time without
losing history), and **bounded** (a small set always loaded, the long tail
recallable on demand).

This doc covers the full design — schema, tool surface, injection format,
and how chat sessions interact with memory. Implementation ships in phases
(5a → 5b → 5c) but the design is one piece.

---

## The four bets

Memory frameworks in 2026 disagree on a lot, so we made four deliberate
calls.

**1. Discrete chat sessions + persistent memory across them.** Not one
infinite scrolling thread (Hermes/messaging model). Each chat ends; durable
facts survive in memory; next chat starts fresh with that memory loaded.

> *Why:* a portfolio assistant has natural session shapes — quick
> check-ins, rebalance discussions, tax questions. Each ends. Memory is what
> makes continuity work without one mega-thread.

**2. Visible memory.** Settings → Memory page shows every stored entry, who
saved it (user/advisor/auto-extracted), when it became true, and a delete
button. No opaque embeddings, no hidden inference.

> *Why:* finance is trust-sensitive. The user should always be able to
> answer "what does this thing know about me?"

**3. Bitemporal validity.** Every entry has `valid_from` / `valid_until`.
Updating a preference *adds a new row* and supersedes the old; nothing is
mutated in place, nothing is deleted (until the user explicitly does).

> *Why:* "risk tolerance was conservative until 2026-01-15, now moderate"
> is a real query for a finance product. Borrowed from Zep's bitemporal
> graph model — simplified to two columns instead of a full graph.

**4. Inject hot, recall cold.** The active set of preferences loads into
the chat system prompt every session start (always-on). A `recall` tool
exists for the long tail of older or archived-chat-extracted notes.

> *Why:* small bounded prompt + on-demand recall is the cross-framework
> consensus (Hermes core/recall, Letta core/archival, Anthropic memory
> tool). Frozen-snapshot discipline keeps the prefix cache hot.

---

## What it looks like to the user

**Saving.** Mid-chat, you say something like *"remember I'm targeting
retirement at 50"* or *"don't suggest individual stocks, I only do
funds."* The model calls `save_preference` under the hood. A small inline
card appears: *"Saved: targeting retirement at 50. Active in your next
chat."*

**Loading.** On every new chat, your active preferences load into the
model's context invisibly. You don't need to re-state them. To see what's
loaded, open **Settings → Memory**.

**Updating.** Saying *"actually, change that to age 55"* triggers
`update_preference` — the old row gets `valid_until = now()`, a new row
takes its place. Memory page shows both with a "superseded" indicator on
the old one.

**Forgetting.** *"Forget the retirement age thing"* triggers
`forget_preference` — `valid_until = now()`. Row stays for audit; never
re-injected. Settings page has a per-row delete button for hard-removal
after 30 days.

**Auto-saved notes** *(Phase 5b)*. When a chat is archived (7 days idle, or
explicit), the assistant scans it for durable facts you stated and saves
them with `source = 'extracted'` and a confidence score. These show up on
the Memory page with a "archived from: \[chat title\]" attribution so you
can trace them back.

---

## Architecture

### Storage

One table, SQLite, owned by the user (post-Phase-6: scoped by `user_id`).

```sql
CREATE TABLE user_preferences (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT,                                  -- NULL pre-Phase-6
  category         TEXT NOT NULL,                         -- enum, see below
  content          TEXT NOT NULL,                         -- the actual fact, prose
  source           TEXT NOT NULL,                         -- 'user_tool' | 'advisor_tool' | 'extracted'
  source_session_id TEXT,                                 -- chat_threads.id, nullable
  source_turn_ids  TEXT,                                  -- JSON array of chat_messages.id, nullable
  confidence       REAL,                                  -- NULL for explicit, 0..1 for extracted
  valid_from       TEXT NOT NULL,                         -- UTC ISO-8601
  valid_until      TEXT,                                  -- UTC ISO-8601, NULL = active
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX idx_user_pref_active ON user_preferences(user_id, valid_until);
CREATE INDEX idx_user_pref_category ON user_preferences(user_id, category, valid_until);
```

Active-entry filter is always `WHERE (valid_until IS NULL OR valid_until > ?)`
with the current UTC timestamp.

All timestamps are stored UTC; the UI renders them in the user's IANA
timezone (which itself is a `profile`-category memory row).

### Categories

Small fixed enum. Adding a category is a schema decision, not a runtime
choice.

| Category | What lives here | Example |
|---|---|---|
| `profile` | Stable facts about the user | risk tolerance, time horizon, age, timezone, retirement target |
| `finance_context` | Accounts, tax situation, constraints | "401k at Fidelity", "Thai tax resident", "no individual stocks" |
| `response_style` | How the advisor should communicate | "be concise", "show percentages not dollars", "skip disclaimers" |
| `fact` | One-off ad-hoc remembers | "wife's name is Sarah", "bought NVDA in March 2026" |

The category drives **injection budget** (each category has a token cap so
one chatty category can't crowd out others) and **Settings UI grouping**.

### Tool surface

Five tools, exposed to the chat model via the Vercel AI SDK shape used
elsewhere in `app/api/chat/`.

| Tool | Args | Returns | Phase |
|---|---|---|---|
| `save_preference` | `{ category, content }` | `{ id }` | 5a |
| `update_preference` | `{ id_or_substring, new_content }` | `{ old_id, new_id }` | 5a |
| `forget_preference` | `{ id_or_substring }` | `{ id }` | 5a |
| `list_preferences` | `{ category?: enum }` | `{ rows: [...] }` | 5a |
| `recall_preferences` | `{ query, category?, limit?: 5 }` | `{ rows: [...] }` | 5b |

**Substring matching for `update` / `forget`:** match by `id` first, then
LIKE-match on `content` (must match exactly one active row, else return
an error listing candidates). Borrowed from Hermes — keeps tool calls
short and natural for the model.

**`recall_preferences` does not exist in 5a.** Until 5b's chat-history
summarization creates a long tail of archived-chat extracted notes, everything
active is already in the injected block. Recall is dead weight until then.

### Injection format

Loaded at session start, rendered into the system prompt, **frozen for the
session** (writes during the chat do not change the injected block —
they apply on the next chat). This is the Hermes discipline; it preserves
the prefix cache and prevents weird mid-session behavior shifts.

Deterministic ordering: categories alphabetical, rows by `id` ascending —
identical content renders byte-identical → cache hit on turn 2+.

```text
## Your stored preferences

### Profile
- risk tolerance: moderate
- time horizon: 10–15 years
- timezone: Asia/Bangkok

### Finance context
- accounts: 401k (Fidelity), Roth IRA (Vanguard), taxable brokerage
- no individual stocks (funds only)

### Response style
- be concise; skip disclaimers
- show percentages, not dollar amounts

### Facts
- wife's name is Sarah
```

Empty categories are omitted. At ~25 tokens per row, ~50 active rows fits
in ~1250 tokens.

**Per-category budget** (token caps; when exceeded, render the most-recent
N rows and add a `… N older items in Settings → Memory` footer):

| Category | Budget (tokens) |
|---|---|
| `profile` | 300 |
| `finance_context` | 500 |
| `response_style` | 200 |
| `fact` | 500 |

Total ceiling: ~1500 tokens. Past that, you should be using `recall`.

---

## Chat session lifecycle

| State | What's true | Transitions |
|---|---|---|
| `active` | Currently focused, accepting messages | → `idle` on switch or "New chat" |
| `idle` | Closed but recent. Full history retained. Not yet archived. | → `active` on reopen. → `archived` after 7 days inactivity. |
| `archived` | Auto-summarized: summary stored, durable facts extracted to memory, message rows kept but marked. | → `active` on resume (banner shown; new summarization cycle begins on next idle). |
| `deleted` | User-deleted. Soft-delete with `deleted_at`. Hard-removed after 30 days. | Restorable from trash bin within 30 days. |

**Why 7 days, not immediate-on-new-chat:** users come back the next day to
ask one more question. Archiving on every "New chat" would punish that.
The real signal of session-end is *absence*, not user action.

**Mid-chat summarization:** none. If an `active` chat crosses ~80% of
model context, the UI shows a banner suggesting a new chat. We don't
summarize behind the user's back.

### User-facing copy used by this feature

Project-wide voice rules live in
[AGENTS.md § Product copy & vocabulary](../../AGENTS.md). Strings
specific to memory + chat-session UX:

| Where it shows | Copy |
|---|---|
| Session state label | "Archived" |
| In-progress indicator | "Summarizing…" |
| Toast on archive | "Q1 rebalance plan archived. Saved 3 notes to memory." |
| Resume banner | "This chat was archived. Earlier turns are summarized." |
| Trash heading | "Deleted chats" (30-day restore) |

---

## Chat sidebar

The sidebar (top to bottom):

```
[+ New Chat]   ⌘K
🔍 Search…                            (Phase 5b)
─────────────────
Today
  • Q1 rebalance plan  ●  (active)
  • Tax loss check
Yesterday
  • Roth conversion math
Previous 7 days
  • Bond allocation Q
Previous 30 days
  • …
Older
  • …
```

**Auto-titling:** after the first user message + assistant response, a
cheap OpenRouter model (configurable; cost-efficient options like
DeepSeek V3 or Qwen3 small variants are well-suited — explicitly *not*
defaulting to Claude/GPT for a 3-5 word title task) generates a
3-5-word title. Placeholder until ready: first ~30 chars of the user
message.

**Per-row actions** (kebab on hover): Rename, Delete, Export-markdown
*(deferred)*.

**Active session indicator:** subtle dot + bold title.

**Empty state:** centered "Start a new chat to begin" with input focused.

**Disclaimer:** a muted line under the chat input on every session
(*"Advisor is AI and can make mistakes."*). Phrasing and styling rules
live in [AGENTS.md § Product copy & vocabulary](../../AGENTS.md).

**Keyboard:**

- `⌘/Ctrl+K` — New Chat
- `⌘/Ctrl+/` — focus search (5b)
- `⌘/Ctrl+[` / `⌘/Ctrl+]` — navigate sessions

**Mobile:** sidebar collapses to a hamburger drawer; same patterns.

---

## Phasing

| Phase | Ships | Depends on |
|---|---|---|
| **5a** | Schema, 4 tools, always-on injection at session start, Settings → Memory page (read + manual delete + restore from trash), chat sidebar with auto-titling + delete | — |
| **5b** | Chat session lifecycle (idle/archived/deleted states + 7-day archive job), archive-time extractor (cheap OpenRouter model writes `source='extracted'` rows), chat-history summarization for context budgeting, `recall_preferences` tool, sidebar search (FTS) | 5a schema |
| **5c+** | Vector recall over archived sessions, cross-session @-references, offline consolidation pass (dedup / supersede / decay) | 5b extraction running long enough to need it |

**Critical:** 5b adds rows to the same table 5a creates. No migration. The
provenance columns (`source`, `source_session_id`, `source_turn_ids`,
`confidence`) exist from day one even though only 5b writes non-NULL
values — this is what makes 5b purely additive.

### 5a acceptance criteria

- User: *"remember I'm targeting retirement at 50"* → advisor calls
  `save_preference` → next new chat shows the advisor knows.
- Settings → Memory lists all active rows grouped by category, with
  per-row delete (→ trash with 30-day restore) and hard-delete from
  trash.
- Saying *"actually, change that to age 55"* triggers `update_preference`;
  Memory page shows the old row as superseded with the new row beside it.
- The injected block is identical across turns 2..N of the same session
  (cache discipline verified by logging the system prompt hash).
- Demo mode: preferences persist for the session and disappear with the
  per-session in-memory SQLite (no special handling).

### 5b acceptance criteria

- Chat idle for 7 days → background job archives the session: writes a summary
  row to `chat_messages` with `role='system'`, marks the chat
  `archived`, and writes 0–N extracted rows to `user_preferences` with
  `source='extracted'` + `source_session_id` + `confidence`.
- Resuming an archived chat shows a banner; new messages don't re-archive
  until idle again.
- `recall_preferences("retirement")` returns relevant active rows
  (LIKE-based in 5b, vector in 5c).
- A 50-turn thread runs at <2× the input-token cost of a 5-turn thread.

---

## Design rationale (what we considered, what we chose, why)

### Why hand-rolled instead of mem0 / Letta / Zep

mem0, Letta, and Zep are excellent but each carries assumptions Macrotide
doesn't share:

- **mem0** — JS SDK, hybrid vector+graph+KV, ~1.8k tokens/query, background
  extraction. *Powerful but opaque* (writes are invisible). For finance we
  want visible writes. Skipped for 5a; revisit if our extraction prompts in
  5b prove fragile.
- **Letta (MemGPT)** — OS-inspired core/archival/recall, self-editing
  memory. Designed for *autonomous long-running agents*, not chat advisors
  with a Settings UI. Wrong shape.
- **Zep** — Production-grade bitemporal knowledge graph (Graphiti).
  Service-oriented, mostly Python. Overkill for ~hundreds of preferences;
  we copy the *bitemporal idea* in two columns instead.
- **LangMem** — Primitives, not a store. Useful reference, not a dep.
- **Cognee** — Six-stage pipeline + 14 retrieval modes. Wrong scale.

The hand-rolled implementation lives in ~200 lines of TypeScript over the
existing Drizzle setup. The whole point is to *not* take a dep with its
own update cadence in a fast-moving field.

### Why bitemporal columns instead of just `updated_at`

A finance product has facts that *change over time and the change matters*.
"I was conservative; I'm moderate now" is two facts, not one with a new
value. The two columns cost nothing and unlock honest temporal queries
later ("when did the user shift to moderate?"). Borrowed from Zep's
bitemporal model. Survey-scout's call: "Most directly relevant to
Macrotide."

### Why inject-only in 5a (no `recall` tool yet)

At 5a launch, pref count is 0. Realistic ceiling before 5b: ~30–50 rows,
~1250 tokens, well under budget. The `recall` tool exists to find things
that *aren't* in the injection block — that long tail only exists once 5b
starts extracting from archived chats. Shipping recall in 5a is dead weight.

### Why visible / user-editable memory

Hermes/Anthropic/OpenHuman/OpenClaw all surface the store. mem0/Zep
hide it. The split is real and the right answer is domain-specific. For a
personal finance assistant, **visible is the right side of the bet** —
users need to be able to answer "what does this thing know about me?" at
any moment, and they need to be able to correct false extractions before
they compound.

### Why discrete sessions, not one long thread

Hermes works in messaging apps because messaging is *already* a series of
discrete sub-conversations. A web chat with a "New chat" button has no
such structure — one long thread becomes a mega-scroll. Discrete sessions
match how people actually think about their financial decisions ("the
rebalance conversation", "the Roth question") and give archive-time
summarization natural boundaries.

### Why "frozen for the session"

The Hermes design discovery: writes during a session don't affect the
injected block until next session. Counterintuitive but it has two real
wins:

1. **Prefix cache stays hot.** The system prompt is byte-identical across
   turns of a session — that block is cached, you only pay for the new
   user message + assistant tokens.
2. **No mid-session behavior shifts.** If the advisor called
   `save_preference("be concise")` on turn 3, it would be jarring for the
   advisor to suddenly become concise on turn 4. Better to let the user
   see it land in the next chat.

UX mitigation: the inline confirmation card explicitly says *"Active in
your next chat"* so the user understands why this chat didn't change.

### Why we don't auto-extract in 5a

Two reasons:

1. **Recursive memory pollution risk.** Supermemory (a Hermes provider)
   explicitly "strips recalled memories from captured turns to prevent
   recursive memory pollution." Auto-extraction without that discipline
   feeds the model's own injected memory back into the next extraction
   pass. We need to design that escape hatch carefully — not in MVP.
2. **Eval cost.** Auto-extraction prompts need real data to tune. Shipping
   5a manually-saved first lets us *generate* that data, then build the
   extractor against actual user preferences in 5b.

---

## Open questions

- **Per-category injection budget tuning.** Numbers in the table are
  educated guesses. Revisit after a month of real usage.
- **What's the right confidence threshold to inject vs only recall?**
  Extracted rows with confidence < 0.7 might be recall-only. TBD in 5b.
- **Should we surface "memory loaded" in chat at all?** Current plan: no —
  Settings → Memory is the single source of truth. If users get confused
  about *why* the advisor knows something, we can add a per-row "view
  source chat" link from the Memory page rather than a per-chat chip.
- **Multi-user isolation (Phase 6).** `user_id` filter is invariant.
  Never surface another user's preferences through any tool call. Add a
  test that runs queries as user A and asserts zero results for user B's
  prefs.

---

## File layout

```text
lib/
  memory/
    schema.ts                 # Drizzle table + types
    preferences.ts            # CRUD + active-filter helper
    inject.ts                 # render injection block from rows
    tools.ts                  # AI SDK tool definitions
    extract.ts                # 5b — archive-time extractor
    recall.ts                 # 5b — LIKE-based, 5c — vector
app/
  api/
    chat/
      route.ts                # inject memory at session start
    memory/
      route.ts                # Settings page CRUD
  settings/
    memory/
      page.tsx                # Settings → Memory UI
components/
  sidebar/
    ChatSidebar.tsx           # session list, new-chat, kebab actions
```

---

## References

This design is consolidated from a multi-scout research pass on 2026-05-23
covering Hermes Agent (Nous Research), OpenHuman, OpenViking/OpenClaw,
mem0, Letta, Zep, LangMem, Cognee, and the Anthropic memory tool. The
research notes themselves are kept locally and not published with this doc
— they age fast and dilute the durable record. See the project memory at
`~/.claude/projects/.../memory/` for the raw findings.
