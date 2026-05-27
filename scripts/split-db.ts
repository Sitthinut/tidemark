// One-time data-move: split a combined SQLite DB into app.db + market.db with
// correct drizzle migration baselines stamped.
//
// An existing combined DB (old single-schema) can't just be opened by the split
// build: its migration history doesn't match the new per-DB baselines, so
// `migrate()` tries to re-CREATE existing tables. This tool builds fresh app.db
// and market.db by running each baseline (which creates the tables AND stamps
// __drizzle_migrations correctly), then bulk-copies the rows in.
//
// Usage:
//   tsx --tsconfig tsconfig.scripts.json scripts/split-db.ts \
//     --app-from <db> --market-from <db> [--out-app data/app.db] [--out-market data/market.db]
//
// Prod move: --app-from <combined> --market-from <combined> (same file for both).
// Local test: --app-from data/app.db.presplit --market-from data/prod-clone.db

import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as appSchema from "@/lib/db/schema/app";
import * as marketSchema from "@/lib/db/schema/market";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

const appFrom = resolve(arg("app-from"));
const marketFrom = resolve(arg("market-from"));
const outApp = resolve(arg("out-app", "data/app.db"));
const outMarket = resolve(arg("out-market", "data/market.db"));
const APP_MIG = resolve("lib/db/migrations/app");
const MARKET_MIG = resolve("lib/db/migrations/market");

// Tables to copy = the target's own user tables, excluding drizzle's tracking
// table and FTS5 shadow/virtual tables (those repopulate via triggers).
function copyableTables(db: Database.Database): string[] {
  return db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table'
         AND name NOT LIKE 'sqlite_%'
         AND name <> '__drizzle_migrations'
         AND name NOT LIKE '%\\_fts%' ESCAPE '\\'`,
    )
    .all()
    .map((r) => (r as { name: string }).name);
}

function build(label: string, outPath: string, migrationsFolder: string, fromPath: string): void {
  console.log(`\n[${label}] building ${outPath} from ${fromPath}`);
  if (existsSync(outPath)) {
    const bak = `${outPath}.bak-${Date.now()}`;
    renameSync(outPath, bak);
    console.log(`  backed up existing -> ${bak}`);
  }
  for (const sfx of ["-wal", "-shm"]) rmSync(`${outPath}${sfx}`, { force: true });

  const db = new Database(outPath);
  db.pragma("journal_mode = WAL");
  // Create tables + stamp __drizzle_migrations to the baseline.
  migrate(drizzle(db, { schema: label === "app" ? appSchema : marketSchema }), {
    migrationsFolder,
  });

  db.pragma("foreign_keys = OFF");
  db.prepare("ATTACH DATABASE ? AS src").run(fromPath);

  const tables = copyableTables(db);
  const copy = db.transaction(() => {
    for (const t of tables) {
      const inSrc = db
        .prepare("SELECT 1 FROM src.sqlite_master WHERE type='table' AND name=?")
        .get(t);
      if (!inSrc) {
        console.log(`  · ${t}: absent in source — skipped`);
        continue;
      }
      const tgtCols = db
        .prepare(`SELECT name FROM pragma_table_info(?)`)
        .all(t)
        .map((r) => (r as { name: string }).name);
      const srcCols = new Set(
        db
          .prepare(`SELECT name FROM pragma_table_info(?, 'src')`)
          .all(t)
          .map((r) => (r as { name: string }).name),
      );
      const cols = tgtCols.filter((c) => srcCols.has(c));
      const list = cols.map((c) => `"${c}"`).join(", ");
      db.prepare(`INSERT INTO "${t}" (${list}) SELECT ${list} FROM src."${t}"`).run();
      const n = (db.prepare(`SELECT count(*) c FROM "${t}"`).get() as { c: number }).c;
      console.log(`  · ${t}: ${n} rows`);
    }
  });
  copy();
  db.prepare("DETACH DATABASE src").run();
  db.exec("VACUUM");
  db.close();
  console.log(`  done.`);
}

build("app", outApp, APP_MIG, appFrom);
build("market", outMarket, MARKET_MIG, marketFrom);
console.log("\nSplit complete.");
