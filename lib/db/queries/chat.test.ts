import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { archiveIdleSessions } from "../../jobs/archive-idle-sessions";
import { getDb, runWithDbContext } from "../context";
import * as schema from "../schema";
import { chatThreads } from "../schema";
import {
  archiveThread,
  createThread,
  findIdleThreads,
  getThread,
  listByStatus,
  markIdle,
} from "./chat";

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

function withFresh<T>(fn: () => T): T {
  const { sqlite, db } = freshDb();
  return runWithDbContext({ db, sqlite, isDemo: true, sessionId: "test" }, fn) as T;
}

/** ISO timestamp `days` days before now. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

/** Create a thread and force its `updatedAt` (last-activity) to a past time. */
function threadAged(days: number): string {
  const t = createThread();
  getDb()
    .update(chatThreads)
    .set({ updatedAt: daysAgo(days) })
    .where(eq(chatThreads.id, t.id))
    .run();
  return t.id;
}

describe("session lifecycle queries", () => {
  it("createThread starts in 'active' with null archivedAt", () => {
    withFresh(() => {
      const t = createThread();
      expect(t.status).toBe("active");
      expect(t.archivedAt).toBeNull();
    });
  });

  it("markIdle flips status to 'idle' without setting archivedAt", () => {
    withFresh(() => {
      const t = createThread();
      const updated = markIdle(t.id);
      expect(updated?.status).toBe("idle");
      expect(updated?.archivedAt).toBeNull();
    });
  });

  it("archiveThread sets status 'archived' and stamps archivedAt", () => {
    withFresh(() => {
      const t = createThread();
      const updated = archiveThread(t.id);
      expect(updated?.status).toBe("archived");
      expect(updated?.archivedAt).toBeTruthy();
    });
  });

  it("listByStatus filters by lifecycle status and excludes trashed threads", () => {
    withFresh(() => {
      const a = createThread();
      const b = createThread();
      markIdle(b.id);
      // Trash an active thread — it should drop out of the active listing.
      const trashed = createThread();
      getDb()
        .update(chatThreads)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(chatThreads.id, trashed.id))
        .run();

      expect(listByStatus("active").map((r) => r.id)).toEqual([a.id]);
      expect(listByStatus("idle").map((r) => r.id)).toEqual([b.id]);
      expect(listByStatus("archived")).toHaveLength(0);
    });
  });

  it("findIdleThreads returns active threads older than the window, ignoring recent ones", () => {
    withFresh(() => {
      const old = threadAged(10);
      threadAged(2); // recent — excluded

      const idle = findIdleThreads(7);
      expect(idle.map((r) => r.id)).toEqual([old]);
    });
  });

  it("findIdleThreads boundary is inclusive at exactly N days", () => {
    withFresh(() => {
      // Exactly 7 days old: updatedAt == now-7d at insert; by query time a few
      // ms have elapsed so it sits just past the cutoff and is included.
      const exact = threadAged(7);
      const idle = findIdleThreads(7);
      expect(idle.map((r) => r.id)).toContain(exact);

      // Just inside the window (6 days) is excluded.
      const recent = threadAged(6);
      expect(findIdleThreads(7).map((r) => r.id)).not.toContain(recent);
    });
  });

  it("findIdleThreads ignores threads not in 'active' status", () => {
    withFresh(() => {
      const archived = threadAged(30);
      archiveThread(archived);
      expect(findIdleThreads(7)).toHaveLength(0);
    });
  });
});

describe("archiveIdleSessions job", () => {
  it("archives active threads idle longer than the window", () => {
    withFresh(() => {
      const stale = threadAged(10);
      threadAged(1); // fresh — left active

      const result = archiveIdleSessions();
      expect(result.archivedCount).toBe(1);
      expect(result.archivedThreadIds).toEqual([stale]);

      const row = getThread(stale);
      expect(row?.status).toBe("archived");
      expect(row?.archivedAt).toBeTruthy();
    });
  });

  it("respects a custom idleDays option", () => {
    withFresh(() => {
      const t = threadAged(3);
      expect(archiveIdleSessions({ idleDays: 7 }).archivedCount).toBe(0);
      expect(archiveIdleSessions({ idleDays: 2 }).archivedCount).toBe(1);
      expect(getThread(t)?.status).toBe("archived");
    });
  });

  it("is idempotent — a second run archives nothing", () => {
    withFresh(() => {
      threadAged(10);
      const first = archiveIdleSessions();
      expect(first.archivedCount).toBe(1);

      const second = archiveIdleSessions();
      expect(second.archivedCount).toBe(0);
      expect(second.archivedThreadIds).toEqual([]);
    });
  });
});
