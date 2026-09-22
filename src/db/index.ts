import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL (or DATABASE_URL) environment variable is required");
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export async function runMigrations() {
  const migrationsFolder = path.resolve("drizzle");
  if (fs.existsSync(migrationsFolder)) {
    await migrate(db, { migrationsFolder });
  }
}
