import "dotenv/config";
import { runMigrations } from "./index";

await runMigrations();
console.log("Migrations applied.");
process.exit(0);
