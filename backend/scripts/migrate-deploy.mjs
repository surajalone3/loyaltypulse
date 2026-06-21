#!/usr/bin/env node
/**
 * Run Prisma migrations with clear Railway-friendly error output.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

if (!process.env.DATABASE_URL?.trim()) {
  console.error("");
  console.error("[migrate-deploy] FATAL: DATABASE_URL is not set.");
  console.error("[migrate-deploy] Railway: add a PostgreSQL plugin and reference DATABASE_URL on this service.");
  console.error("[migrate-deploy] Example: DATABASE_URL=${{Postgres.DATABASE_URL}}");
  console.error("");
  process.exit(1);
}

console.log("[migrate-deploy] Running prisma migrate deploy...");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("");
  console.error("[migrate-deploy] FATAL: prisma migrate deploy failed.");
  console.error("[migrate-deploy] Common causes:");
  console.error("  • DATABASE_URL points to unreachable or wrong database");
  console.error("  • Railway Postgres not linked to this service");
  console.error("  • Database credentials expired or SSL required (add ?sslmode=require)");
  console.error("  • P3009 failed migration — run: npm run prisma:recover:railway");
  console.error("    See docs/PRISMA_MIGRATION_RECOVERY.md");
  console.error("");
  process.exit(result.status ?? 1);
}

console.log("[migrate-deploy] Migrations applied successfully");
