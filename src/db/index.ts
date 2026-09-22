import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
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
  if (fs.existsSync(migrationsFolder)) {
    await migrate(migrationDb, { migrationsFolder });
  }
  await client.end();
}
