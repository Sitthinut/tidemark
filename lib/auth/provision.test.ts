// New-user provisioning (Phase 6 — 6c): a freshly-created user gets a default
// 'free' account_tier row and one seeded bucket stamped with their user_id.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { type DbContext, runWithDbContext } from "../db/context";
import { listBuckets } from "../db/queries/buckets";
import * as schema from "../db/schema";
import { accountTier, user } from "../db/schema";
import { provisionNewUser } from "./provision";

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

function seedUser(db: ReturnType<typeof freshDb>["db"], id: string) {
  const now = new Date();
  db.insert(user)
    .values({
      id,
      name: id,
      email: `${id}@x.io`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

describe("provisionNewUser", () => {
  it("inserts a default 'free' account_tier row and seeds one owned bucket", () => {
    const { sqlite, db } = freshDb();
    seedUser(db, "u1");
    const ctx: DbContext = { db, sqlite, isDemo: false, sessionId: "owner", userId: "u1" };

    runWithDbContext(ctx, () => {
      provisionNewUser("u1");

      const tier = db.select().from(accountTier).where(eq(accountTier.userId, "u1")).get();
      expect(tier?.tier).toBe("free");
      expect(tier?.grantedAt).toBeTruthy();

      const buckets = listBuckets();
      expect(buckets).toHaveLength(1);
      expect(buckets[0]?.userId).toBe("u1");
    });
  });

  it("is idempotent on the tier row (ON CONFLICT DO NOTHING)", () => {
    const { sqlite, db } = freshDb();
    seedUser(db, "u1");
    const ctx: DbContext = { db, sqlite, isDemo: false, sessionId: "owner", userId: "u1" };

    runWithDbContext(ctx, () => {
      provisionNewUser("u1");
      // Calling again must not throw on the PK conflict.
      expect(() => provisionNewUser("u1")).not.toThrow();
      const tiers = db.select().from(accountTier).where(eq(accountTier.userId, "u1")).all();
      expect(tiers).toHaveLength(1);
    });
  });

  it("isolates the seeded bucket to its owner", () => {
    const { sqlite, db } = freshDb();
    seedUser(db, "u1");
    seedUser(db, "u2");

    runWithDbContext({ db, sqlite, isDemo: false, sessionId: "owner", userId: "u1" }, () =>
      provisionNewUser("u1"),
    );
    runWithDbContext({ db, sqlite, isDemo: false, sessionId: "owner", userId: "u2" }, () =>
      provisionNewUser("u2"),
    );

    runWithDbContext({ db, sqlite, isDemo: false, sessionId: "owner", userId: "u1" }, () => {
      const buckets = listBuckets();
      expect(buckets).toHaveLength(1);
      expect(buckets[0]?.userId).toBe("u1");
    });
  });
});
