import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

function getConnectionString() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) environment variable is required");
  }
  return url;
}

let _db: PostgresJsDatabase<typeof schema> | undefined;

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) {
      const client = postgres(getConnectionString());
      _db = drizzle(client, { schema });
    }
    return Reflect.get(_db, prop, receiver);
  },
});

export async function runMigrations() {
  const client = postgres(getConnectionString(), { max: 1 });
  const migrationDb = drizzle(client, { schema });
  const migrationsFolder = path.resolve("drizzle");
  try {
    if (!fs.existsSync(migrationsFolder)) return;

    // The migration history has been squashed before, which leaves some existing
    // DBs already carrying a migration's schema changes while missing its row in
    // `__drizzle_migrations`. Drizzle then re-runs that migration and fails with
    // "already exists". When that happens, record the pending migration as
    // applied (its effects are already present) and retry. Each pass advances
    // the ledger, so the loop always terminates.
    for (;;) {
      try {
        await migrate(migrationDb, { migrationsFolder });
        return;
      } catch (err) {
        if (!isAlreadyAppliedError(err) || !(await recordPendingMigration(client, migrationsFolder))) {
          throw err;
        }
      }
    }
  } finally {
    await client.end();
  }
}

// Postgres codes for duplicate column / table / object (index, constraint, type).
const ALREADY_EXISTS_CODES = new Set(["42701", "42P07", "42710"]);

function isAlreadyAppliedError(err: unknown): boolean {
  const codeOf = (e: unknown) =>
    e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  const cause = err instanceof Error ? err.cause : undefined;
  return ALREADY_EXISTS_CODES.has(codeOf(err)) || ALREADY_EXISTS_CODES.has(codeOf(cause));
}

// Insert a `__drizzle_migrations` row for the first migration drizzle still
// considers pending, mirroring how drizzle selects what to run (everything with
// `when` greater than the newest recorded `created_at`). Returns false when
// nothing is pending, so the caller can rethrow instead of looping forever.
async function recordPendingMigration(
  client: postgres.Sql,
  migrationsFolder: string,
): Promise<boolean> {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };

  const [last] = await client<{ created_at: string }[]>`
    SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1
  `;
  const lastMillis = last ? Number(last.created_at) : -1;

  const pending = journal.entries.find((entry) => entry.when > lastMillis);
  if (!pending) return false;

  const sql = fs.readFileSync(path.join(migrationsFolder, `${pending.tag}.sql`), "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  await client`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${pending.when})
  `;
  return true;
}
