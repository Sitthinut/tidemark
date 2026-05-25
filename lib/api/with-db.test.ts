import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbContext } from "@/lib/db/context";

// Routing-precedence contract for withDb():
//   - authenticated user  -> owner context (isDemo:false, that userId), even
//     if a stale demo cookie is present. Session wins.
//   - no user + demo cookie -> isolated demo session (isDemo:true, userId:null).
//   - no user + no cookie   -> owner singleton, userId:null (single-owner /
//     AUTH_DISABLED behavior).
//
// We mock the collaborators so the test exercises only the branching logic and
// doesn't open real SQLite handles.

const mockCookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

const mockRequireUser = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => mockRequireUser(),
}));

// Sentinel handles so we can assert which DB the context points at.
const ownerDb = { __which: "owner-db" } as unknown;
const ownerSqlite = { __which: "owner-sqlite" } as unknown;
vi.mock("@/lib/db/client", () => ({
  get ownerDb() {
    return ownerDb;
  },
  get ownerSqlite() {
    return ownerSqlite;
  },
}));

const demoDb = { __which: "demo-db" } as unknown;
const demoSqlite = { __which: "demo-sqlite" } as unknown;
const mockGetOrCreateDemoSession = vi.fn((_id: string) => ({ db: demoDb, sqlite: demoSqlite }));
vi.mock("@/lib/db/demo", () => ({
  getOrCreateDemoSession: (id: string) => mockGetOrCreateDemoSession(id),
}));

// runWithDbContext just runs the fn; we capture the ctx it was handed.
vi.mock("@/lib/db/context", () => ({
  runWithDbContext: <T>(_ctx: DbContext, fn: () => T | Promise<T>) => fn(),
}));

import { withDb } from "./with-db";

function setDemoCookie(value: string | undefined) {
  mockCookieStore.get.mockReturnValue(value ? { value } : undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDemoCookie(undefined);
  mockRequireUser.mockResolvedValue(null);
});

describe("withDb routing precedence", () => {
  it("authenticated user wins over a stale demo cookie -> owner context", async () => {
    mockRequireUser.mockResolvedValue("user-123");
    setDemoCookie("demo-abc"); // stale demo cookie present

    const ctx = await withDb((c) => c);

    expect(ctx.isDemo).toBe(false);
    expect(ctx.userId).toBe("user-123");
    expect(ctx.sessionId).toBe("owner");
    expect(ctx.db).toBe(ownerDb);
    expect(ctx.sqlite).toBe(ownerSqlite);
    // The demo session must never be materialized for a logged-in user.
    expect(mockGetOrCreateDemoSession).not.toHaveBeenCalled();
  });

  it("anonymous user + demo cookie -> isolated demo context", async () => {
    mockRequireUser.mockResolvedValue(null);
    setDemoCookie("demo-abc");

    const ctx = await withDb((c) => c);

    expect(ctx.isDemo).toBe(true);
    expect(ctx.userId).toBeNull();
    expect(ctx.sessionId).toBe("demo-abc");
    expect(ctx.db).toBe(demoDb);
    expect(ctx.sqlite).toBe(demoSqlite);
    expect(mockGetOrCreateDemoSession).toHaveBeenCalledWith("demo-abc");
  });

  it("no user + no cookie -> owner singleton, userId null (single-owner / AUTH_DISABLED)", async () => {
    mockRequireUser.mockResolvedValue(null);
    setDemoCookie(undefined);

    const ctx = await withDb((c) => c);

    expect(ctx.isDemo).toBe(false);
    expect(ctx.userId).toBeNull();
    expect(ctx.sessionId).toBe("owner");
    expect(ctx.db).toBe(ownerDb);
    expect(mockGetOrCreateDemoSession).not.toHaveBeenCalled();
  });
});
