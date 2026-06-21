#!/usr/bin/env node
/**
 * Railway recovery for Prisma P3009 (failed migration in target database).
 *
 * Usage (from repo root, with Railway DATABASE_URL):
 *   npm run prisma:recover:railway
 *
 * Or manually:
 *   cd backend && npx prisma migrate resolve --rolled-back 20260607120000_add_rewards
 *   cd backend && npx prisma migrate deploy
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

const FAILED_MIGRATION = "20260607120000_add_rewards";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[recover] FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

console.log("=== LoyaltyPulse Prisma migration recovery ===\n");
console.log(`Target failed migration: ${FAILED_MIGRATION}`);
console.log("Reason: add_rewards references Store, which was missing until");
console.log("        20260607100000_core_loyalty_schema was added.\n");

console.log(`[recover] Marking ${FAILED_MIGRATION} as rolled back...`);
const resolveStatus = run("npx", [
  "prisma",
  "migrate",
  "resolve",
  "--rolled-back",
  FAILED_MIGRATION,
]);

if (resolveStatus !== 0) {
  console.error("");
  console.error("[recover] resolve failed. If the migration is not in failed state,");
  console.error("          check _prisma_migrations or run deploy after fixing manually.");
  process.exit(resolveStatus);
}

console.log("\n[recover] Running prisma migrate deploy...");
const deployStatus = run("npx", ["prisma", "migrate", "deploy"]);

if (deployStatus !== 0) {
  console.error("\n[recover] migrate deploy failed — inspect logs above.");
  process.exit(deployStatus);
}

console.log("\n[recover] Success. Redeploy Railway or run: npm start");
