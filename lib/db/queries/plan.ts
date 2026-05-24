import { and, eq } from "drizzle-orm";
import { getDb } from "../context";
import { plans } from "../schema";
import { ownedBy, ownerId } from "./scope";

export type Plan = typeof plans.$inferSelect;

// Single-row table for v1 (one plan, id=1). NOTE: `user_id` is now scoped on
// reads, but the fixed `id=1` PK still means there is one plan row shared
// across users. In single-owner mode (userId null) this is unchanged. A true
// per-user plan needs a (user_id)-keyed redesign — deferred; out of scope for
// the current data-layer foundation.
const PLAN_ID = 1;

export function getPlan(): Plan | undefined {
  return getDb()
    .select()
    .from(plans)
    .where(and(eq(plans.id, PLAN_ID), ownedBy(plans.userId)))
    .get();
}

export function upsertPlan(input: { markdown: string; selectedModelId?: string | null }): Plan {
  const now = new Date().toISOString();
  return getDb()
    .insert(plans)
    .values({
      id: PLAN_ID,
      userId: ownerId(),
      markdown: input.markdown,
      selectedModelId: input.selectedModelId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: plans.id,
      set: {
        markdown: input.markdown,
        selectedModelId: input.selectedModelId ?? null,
        updatedAt: now,
      },
    })
    .returning()
    .get();
}
