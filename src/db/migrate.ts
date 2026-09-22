import "dotenv/config";
import { runMigrations } from "./index";

runMigrations().then(() => {
  console.log("Migrations applied.");
  process.exit(0);
});
