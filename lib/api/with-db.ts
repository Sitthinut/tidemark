import "server-only";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { ownerDb, ownerSqlite } from "@/lib/db/client";
import { type DbContext, runWithDbContext } from "@/lib/db/context";
import { getOrCreateDemoSession } from "@/lib/db/demo";

export const DEMO_COOKIE = "macrotide_demo";

/**
 * Resolve a per-request DB context. If the request carries a `macrotide_demo`
 * cookie, we route reads/writes to that session's in-memory SQLite. Otherwise
 * the owner singleton is used.
 *
 * For non-demo requests we also resolve the authenticated user id (Phase 6) and
 * carry it on the context so per-user query scoping (lib/db/queries/scope.ts)
 * applies. `userId` is null in single-owner / `AUTH_DISABLED` mode, which makes
 * scoping collapse to the legacy `user_id IS NULL` set — behavior is identical
 * to pre-Phase-6. Demo sessions are already isolated, so they stay `userId:
 * null`.
 *
 * Wrap every route handler that touches `getDb()` with this so demo sessions
 * remain isolated.
 */
export async function withDb<T>(fn: (ctx: DbContext) => T | Promise<T>): Promise<T> {
  const store = await cookies();
  const demoId = store.get(DEMO_COOKIE)?.value;
  let ctx: DbContext;
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
    const userId = await requireUser();
    ctx = { db: ownerDb, sqlite: ownerSqlite, isDemo: false, sessionId: "owner", userId };
  }

  return await runWithDbContext(ctx, async () => fn(ctx));
}
