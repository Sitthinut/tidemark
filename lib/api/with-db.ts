import "server-only";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { ownerDb, ownerSqlite } from "@/lib/db/client";
import { type DbContext, runWithDbContext } from "@/lib/db/context";
import { getOrCreateDemoSession } from "@/lib/db/demo";

export const DEMO_COOKIE = "macrotide_demo";

/**
 * Resolve a per-request DB context. An **authenticated session always wins**:
 * if a user is logged in we route to the owner DB scoped to their id and ignore
 * any lingering `macrotide_demo` cookie. Only when there is NO authenticated
 * user AND a demo cookie is present do we route reads/writes to that session's
 * isolated in-memory SQLite. Otherwise the owner singleton is used.
 *
 * For owner requests we carry the authenticated user id on the context so
 * per-user query scoping (lib/db/queries/scope.ts) applies. `userId` is null in
 * single-owner / `AUTH_DISABLED` mode, which makes scoping collapse to the
 * legacy `user_id IS NULL` set — behavior is identical to single-owner mode.
 * Demo sessions are already isolated, so they stay `userId: null`.
 *
 * Wrap every route handler that touches `getDb()` with this so demo sessions
 * remain isolated.
 */
export async function withDb<T>(fn: (ctx: DbContext) => T | Promise<T>): Promise<T> {
  // Resolve the user FIRST so an authenticated session takes precedence over a
  // stale demo cookie. A logged-in user must never be routed to demo data.
  const userId = await requireUser();
  let ctx: DbContext;
  if (userId) {
    ctx = { db: ownerDb, sqlite: ownerSqlite, isDemo: false, sessionId: "owner", userId };
  } else {
    // No authenticated user. Fall back to a demo session if the cookie is set,
    // otherwise the single-owner / AUTH_DISABLED owner context (userId: null).
    const store = await cookies();
    const demoId = store.get(DEMO_COOKIE)?.value;
    if (demoId) {
      const session = getOrCreateDemoSession(demoId);
      ctx = {
        db: session.db,
        sqlite: session.sqlite,
        isDemo: true,
        sessionId: demoId,
        userId: null,
      };
    } else {
      ctx = { db: ownerDb, sqlite: ownerSqlite, isDemo: false, sessionId: "owner", userId: null };
    }
  }

  return await runWithDbContext(ctx, async () => fn(ctx));
}
