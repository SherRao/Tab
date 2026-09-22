import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const dbPath = url.replace(/^file:/, "");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function runMigrations() {
  const migrationsFolder = path.resolve("drizzle");
  if (!fs.existsSync(migrationsFolder)) return;

  // The migration history has been squashed before, which leaves some existing
  // DBs already carrying a migration's schema changes while missing its row in
  // `__drizzle_migrations`. Drizzle then re-runs that migration and fails with
  // "duplicate column name" / "already exists". When that happens, record the
  // pending migration as applied (its effects are already present) and retry.
  // Each pass advances the ledger, so the loop always terminates.
  for (;;) {
    try {
      migrate(db, { migrationsFolder });
      return;
    } catch (err) {
      if (!isAlreadyAppliedError(err) || !recordPendingMigration(migrationsFolder)) {
        throw err;
      }
    }
  }
}

function isAlreadyAppliedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  return /duplicate column name|already exists/i.test(`${message} ${cause}`);
}

// Insert a `__drizzle_migrations` row for the first migration drizzle still
// considers pending, mirroring how drizzle selects what to run (everything with
// `when` greater than the newest recorded `created_at`). Returns false when
// nothing is pending, so the caller can rethrow instead of looping forever.
function recordPendingMigration(migrationsFolder: string): boolean {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };

  const client = db.$client;
  const last = client
    .prepare("SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")
    .get() as { created_at: number } | undefined;
  const lastMillis = last ? Number(last.created_at) : -1;

  const pending = journal.entries.find((entry) => entry.when > lastMillis);
  if (!pending) return false;

  const sql = fs.readFileSync(path.join(migrationsFolder, `${pending.tag}.sql`), "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  client
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run(hash, pending.when);
  return true;
}
