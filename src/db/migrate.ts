import "dotenv/config";
import { db, runMigrations } from "./index";

runMigrations();
console.log("Migrations applied.");
void db.$client.close();
