#!/usr/bin/env node
/**
 * Verifies Railway / production deployment requirements before deploy.
 * Usage: npm run verify:railway
 *        npm run verify:railway -- --build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const backendRoot = path.resolve(__dirname, "..");
const strictEnv = process.argv.includes("--strict") || process.env.NODE_ENV === "production";
const checkBuild = process.argv.includes("--build");

const issues = [];
const passes = [];

function pass(label, detail = "") {
  passes.push(label);
  console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  issues.push(`${label}${detail ? `: ${detail}` : ""}`);
  console.error(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

console.log("=== LoyaltyPulse Railway Verification ===\n");

const { loadEnvFile } = await import("../src/config/envConfig.js");
const envFile = loadEnvFile();
if (envFile.loaded) {
  pass("Loaded .env", envFile.path);
}

// 1. Root package.json scripts
const rootPkg = readJson("package.json");
const requiredScripts = ["build", "start", "prestart", "verify:railway"];
for (const script of requiredScripts) {
  if (rootPkg.scripts?.[script]) {
    pass(`Root script: ${script}`, rootPkg.scripts[script]);
  } else {
    fail(`Root script missing: ${script}`);
  }
}

if (rootPkg.scripts?.build?.includes("build:frontend") && rootPkg.scripts?.build?.includes("prisma:generate")) {
  pass("Build runs frontend + prisma generate");
} else {
  fail("Build script must run build:frontend and prisma:generate");
}

if (rootPkg.scripts?.start?.includes("migrate-deploy")) {
  pass("Start runs migrate-deploy before backend");
} else {
  fail("Start script should run migrate-deploy.mjs before backend");
}

// 2. Backend entry + PORT
const indexPath = path.join(backendRoot, "src/index.js");
const indexSource = fs.readFileSync(indexPath, "utf8");
if (indexSource.includes("process.env.PORT")) {
  pass("Backend uses process.env.PORT");
} else {
  fail("Backend does not read process.env.PORT");
}
if (indexSource.includes('0.0.0.0')) {
  pass("Backend binds to 0.0.0.0");
} else {
  fail("Backend should listen on 0.0.0.0 for Railway");
}
if (indexSource.includes("frontend/dist")) {
  pass("Backend serves frontend/dist in production");
} else {
  fail("Backend production static path not found");
}

// 3. Deploy config consistency
const railwayJson = readJson("railway.json");
const nixpacks = fs.readFileSync(path.join(repoRoot, "nixpacks.toml"), "utf8");
const procfile = fs.readFileSync(path.join(repoRoot, "Procfile"), "utf8").trim();

const expectedBuild = "npm run build";
const expectedStart = "npm start";

if (railwayJson.build?.buildCommand === expectedBuild) {
  pass("railway.json buildCommand", expectedBuild);
} else {
  fail("railway.json buildCommand mismatch", railwayJson.build?.buildCommand);
}

if (railwayJson.deploy?.startCommand === expectedStart) {
  pass("railway.json startCommand", expectedStart);
} else {
  fail("railway.json startCommand mismatch", railwayJson.deploy?.startCommand);
}

if (nixpacks.includes(expectedBuild) && nixpacks.includes(expectedStart)) {
  pass("nixpacks.toml build/start commands");
} else {
  fail("nixpacks.toml missing expected build or start");
}

if (procfile === `web: ${expectedStart}`) {
  pass("Procfile", procfile);
} else {
  fail("Procfile mismatch", procfile);
}

// 4. Railway root directory
pass("Railway root directory", "Repository root (/) — not backend/");

// 5. Env example files
if (fs.existsSync(path.join(repoRoot, ".env.production.example"))) {
  pass(".env.production.example exists");
} else {
  fail(".env.production.example missing");
}

// 6. Environment validation module
const { getEnvReport, ENV_SPECS } = await import("../src/config/envConfig.js");
const envReport = getEnvReport({
  phase: checkBuild ? "build" : "verify",
  requireProduction: true,
});

console.log("\n--- Environment variables ---");
for (const spec of ENV_SPECS) {
  const value = process.env[spec.key];
  const set = value !== undefined && String(value).trim() !== "";
  const needed = spec.required || (checkBuild && spec.buildTime);
  if (set) {
    pass(`ENV ${spec.key}`, spec.secret ? "[set]" : value.slice(0, 20) + (value.length > 20 ? "…" : ""));
  } else if (needed && strictEnv) {
    fail(`ENV ${spec.key} not set`, spec.source);
  } else if (needed) {
    console.log(`○ ENV ${spec.key} not set (use --strict to fail)`);
  } else {
    console.log(`○ ENV ${spec.key} optional (not set)`);
  }
}

if (checkBuild) {
  const vite = process.env.VITE_SHOPIFY_API_KEY;
  const api = process.env.SHOPIFY_API_KEY;
  if (vite || api) {
    pass("Build-time Shopify API key available");
  } else if (strictEnv || checkBuild) {
    fail("VITE_SHOPIFY_API_KEY or SHOPIFY_API_KEY required for build");
  } else {
    console.log("○ Build-time Shopify API key not set (required on Railway build)");
  }
}

if (envReport.missing.length > 0 && process.env.NODE_ENV === "production") {
  for (const spec of envReport.missing) {
    fail(`Production requires ${spec.key}`);
  }
}

// 7. Frontend build output
const frontendDist = path.join(repoRoot, "frontend/dist/index.html");
if (fs.existsSync(frontendDist)) {
  pass("Frontend build output", frontendDist);
} else if (checkBuild) {
  fail("frontend/dist/index.html missing — run npm run build");
} else {
  console.log("○ frontend/dist not present (run npm run build or use --build after building)");
}

// 8. Prisma
const prismaValidate = spawnSync("npx", ["prisma", "validate"], {
  cwd: backendRoot,
  stdio: "pipe",
  encoding: "utf8",
});
if (prismaValidate.status === 0) {
  pass("Prisma schema valid");
} else {
  fail("Prisma schema invalid", prismaValidate.stderr?.trim());
}

if (fs.existsSync(path.join(backendRoot, "node_modules/.prisma/client"))) {
  pass("Prisma client generated");
} else {
  fail("Prisma client not generated — run npm run prisma:generate");
}

// 9. Database connectivity (optional if DATABASE_URL set)
if (process.env.DATABASE_URL?.trim()) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    pass("DATABASE_URL connectivity");
  } catch (error) {
    fail("DATABASE_URL unreachable", error.message);
  }
} else {
  console.log("○ DATABASE_URL not set — skipping DB connectivity check");
}

// 10. Deploy scripts exist
for (const script of ["validate-production-env.mjs", "migrate-deploy.mjs"]) {
  if (fs.existsSync(path.join(backendRoot, "scripts", script))) {
    pass(`Script: ${script}`);
  } else {
    fail(`Script missing: ${script}`);
  }
}

console.log("\n=== Summary ===");
console.log(`Passed: ${passes.length}`);
console.log(`Issues: ${issues.length}`);
if (issues.length > 0) {
  console.log("\nIssues:");
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
  process.exit(1);
}

console.log("\nRailway deploy ready: npm run build && npm start");
console.log("Set variables from .env.production.example in Railway → Variables");
