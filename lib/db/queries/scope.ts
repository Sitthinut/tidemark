// Per-user row scoping (Phase 6 — 6a data layer).
//
// User-owned tables (buckets, journal_entries, plans, chat_threads,
// model_portfolios) carry a nullable `user_id`. Rows with NULL user_id are
// built-ins / pre-backfill data and stay visible to EVERYONE.
//
// Reads/writes are scoped with {@link ownedBy}: it matches the current user's
// rows OR the shared NULL-owned rows. When there is no user in context
// (single-owner / pre-auth / demo — `getUserId()` returns null), the clause
// collapses to `user_id IS NULL`, which is exactly the pre-Phase-6 row set —
// so behavior is identical to today and existing tests pass unchanged.
import { eq, isNull, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getUserId } from "../context";

/**
 * WHERE fragment scoping a user-owned table's `user_id` column to the current
 * request's user, plus the shared NULL-owned rows. Combine with other
 * conditions via `and(...)`.
 */
export function ownedBy(userIdColumn: SQLiteColumn): SQL {
  const userId = getUserId();
  if (userId === null) return isNull(userIdColumn);
  // biome-ignore lint/style/noNonNullAssertion: or() with 2 args always returns SQL
  return or(eq(userIdColumn, userId), isNull(userIdColumn))!;
}

/**
 * The `user_id` value to stamp on inserts: the current user, or `null` in
 * single-owner / pre-auth / demo mode (identical to pre-Phase-6 inserts, which
 * had no column at all).
 */
export function ownerId(): string | null {
  return getUserId();
}
