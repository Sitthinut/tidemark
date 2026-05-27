// Per-worker test database isolation.
//
// lib/db/client.ts runs drizzle `migrate()` against process.env.DB_PATH and
// process.env.MARKET_DB_PATH (defaults data/app.db, data/market.db) at import
// time. Vitest runs test files across several worker processes; without
// isolation they all migrate the SAME files at once, and drizzle's migrator is
// not concurrency-safe — two workers each see zero applied migrations and both
// replay 0000, throwing "table `buckets` already exists". (Most suites use the
// in-memory freshDb helpers and are unaffected; the few that import the real
// client transitively are the ones that raced.)
//
// Giving each worker its own files makes the migrate idempotent per process and
// keeps tests from dirtying the repo's data/*.db. `??=` so explicitly set paths
// still win (e.g. when debugging against a specific file).
import { tmpdir } from "node:os";
import { join } from "node:path";

const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
process.env.DB_PATH ??= join(tmpdir(), `macrotide-test-app-${process.pid}-${workerId}.db`);
process.env.MARKET_DB_PATH ??= join(
  tmpdir(),
  `macrotide-test-market-${process.pid}-${workerId}.db`,
);
