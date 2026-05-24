// Per-user scoping invariant. These lock in the contract the multi-user data
// layer builds on:
//   - With NO user in context (single-owner / pre-auth), behavior is identical
//     to single-owner mode: every row is visible/writable (the legacy NULL set).
//   - With a user in context, that user sees their own rows PLUS shared
//     NULL-owned rows, but NOT another user's rows.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { type DbContext, runWithDbContext } from "../context";
import * as schema from "../schema";
import { user } from "../schema";
import { createBucket, listBuckets } from "./buckets";

function freshDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const migrationsDir = resolve("lib/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = files
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n")
    .replace(/--> statement-breakpoint/g, ";");
  sqlite.exec(sql);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const BUCKET = {
  id: "b",
  name: "B",
  typeLabel: null,
  icon: null,
  color: null,
  brokerage: "FNDQ",
  notes: null,
  goalText: null,
  targetModelId: null,
  targetAllocation: null,
};

describe("per-user row scoping", () => {
  it("null context behaves like single-owner: all rows visible + NULL user_id", () => {
    const { sqlite, db } = freshDb();
    const ctx: DbContext = { db, sqlite, isDemo: false, sessionId: "owner", userId: null };
    runWithDbContext(ctx, () => {
      const created = createBucket(BUCKET);
      expect(created.userId).toBeNull();
      expect(listBuckets()).toHaveLength(1);
    });
  });

  it("a user sees own rows + shared NULL rows, but not another user's", () => {
    const { sqlite, db } = freshDb();
    const now = new Date();
    // FK target rows.
    db.insert(user)
      .values([
        {
          id: "u1",
          name: "U1",
          email: "u1@x.io",
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "u2",
          name: "U2",
          email: "u2@x.io",
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    const asNull: DbContext = { db, sqlite, isDemo: false, sessionId: "s", userId: null };
    const asU1: DbContext = { db, sqlite, isDemo: false, sessionId: "s", userId: "u1" };
    const asU2: DbContext = { db, sqlite, isDemo: false, sessionId: "s", userId: "u2" };

    // A shared (built-in / pre-backfill) row + one row per user.
    runWithDbContext(asNull, () => createBucket({ ...BUCKET, id: "shared", name: "Shared" }));
    runWithDbContext(asU1, () => createBucket({ ...BUCKET, id: "b1", name: "B1" }));
    runWithDbContext(asU2, () => createBucket({ ...BUCKET, id: "b2", name: "B2" }));

    runWithDbContext(asU1, () => {
      expect(createBucket({ ...BUCKET, id: "b1b", name: "B1b" }).userId).toBe("u1");
      const ids = listBuckets()
        .map((b) => b.id)
        .sort();
      expect(ids).toEqual(["b1", "b1b", "shared"]); // u1's rows + shared, NOT b2
    });

    runWithDbContext(asU2, () => {
      const ids = listBuckets()
        .map((b) => b.id)
        .sort();
      expect(ids).toEqual(["b2", "shared"]);
    });
  });
});
