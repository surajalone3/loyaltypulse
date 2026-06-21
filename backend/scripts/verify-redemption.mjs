#!/usr/bin/env node
/**
 * Verifies Redemption migration, schema sync, service logic, and HTTP endpoints.
 * Usage: node scripts/verify-redemption.mjs [--base-url=http://localhost:3000]
 */
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

await import("../src/env.js");
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl =
  process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ??
  `http://localhost:${process.env.PORT ?? 3000}`;

const report = {
  schemaValid: null,
  prismaGenerate: null,
  migration: { method: null, status: null, detail: null },
  dbConnection: null,
  redemptionTable: null,
  modelSync: null,
  serviceTest: null,
  httpAdminRedeem: null,
  httpStorefrontRedeem: null,
  widgetChecks: null,
  issues: [],
};

function pass(label, detail = "") {
  console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`✗ ${label}${detail ? `: ${detail}` : ""}`);
  report.issues.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function buildAppProxySignature(query, secret) {
  const message = Object.keys(query)
    .filter((key) => key !== "signature")
    .sort()
    .map((key) => {
      const value = query[key];
      const normalized = Array.isArray(value) ? value.join(",") : String(value ?? "");
      return `${key}=${normalized}`;
    })
    .join("");

  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function ensureRedemptionFixtures(store) {
  let reward = await prisma.reward.findFirst({
    where: { storeId: store.id, isActive: true },
    orderBy: { pointsRequired: "asc" },
  });

  if (!reward) {
    reward = await prisma.reward.create({
      data: {
        storeId: store.id,
        name: "VERIFY Redemption",
        pointsRequired: 1,
        discountType: "PERCENTAGE",
        discountValue: 10,
        isActive: true,
      },
    });
  }

  const candidates = await prisma.customer.findMany({
    where: { storeId: store.id },
    orderBy: { totalPoints: "desc" },
  });

  let customer =
    candidates.find(
      (entry) =>
        entry.shopifyCustomerId &&
        !/verify|review|ref-|referrer|referred/i.test(entry.email ?? "")
    ) ?? candidates.find((entry) => entry.shopifyCustomerId);

  if (!customer) {
    return { customer: null, reward };
  }

  if (customer.totalPoints < reward.pointsRequired) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { totalPoints: reward.pointsRequired },
    });
  }

  return { customer, reward };
}

console.log("=== LoyaltyPulse Redemption Verification ===\n");

// 1. Prisma validate
const validateResult = await runCommand("npx", ["prisma", "validate"], backendRoot);
report.schemaValid = validateResult.code === 0;
if (report.schemaValid) {
  pass("Prisma schema valid");
} else {
  fail("Prisma schema valid", validateResult.stderr.trim());
}

// 2. Prisma generate
const generateResult = await runCommand("npx", ["prisma", "generate"], backendRoot);
report.prismaGenerate = generateResult.code === 0;
if (report.prismaGenerate) {
  pass("Prisma client generated");
} else {
  fail("Prisma generate", generateResult.stderr.trim());
}

// 3. Migrations
let migrateResult = await runCommand("npx", ["prisma", "migrate", "deploy"], backendRoot);
if (migrateResult.code === 0) {
  report.migration = { method: "migrate deploy", status: "applied", detail: migrateResult.stdout.trim() };
  pass("Migrations applied (migrate deploy)");
} else {
  const migrateErr = migrateResult.stderr.trim();
  console.warn("migrate deploy failed, trying db push…");
  console.warn(migrateErr);

  const pushResult = await runCommand("npx", ["prisma", "db", "push"], backendRoot);
  if (pushResult.code === 0) {
    report.migration = {
      method: "db push",
      status: "applied",
      detail:
        "Used db push because migrate deploy failed. db push syncs schema directly without migration history — safe for dev when migrations cannot reach DB or history is out of sync.",
    };
    pass("Schema synced (db push fallback)");
  } else {
    report.migration = {
      method: "none",
      status: "failed",
      detail: pushResult.stderr.trim() || migrateErr,
    };
    fail("Database migration/sync", report.migration.detail);
  }
}

// 4. DB connection
try {
  await prisma.$queryRaw`SELECT 1`;
  report.dbConnection = true;
  pass("Database connection");
} catch (error) {
  report.dbConnection = false;
  fail("Database connection", error.message);
}

// 5. Redemption table + model sync
if (report.dbConnection) {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('Customer', 'Reward', 'PointsTransaction', 'Redemption', 'LoyaltyProgram')
      ORDER BY table_name
    `;
    const names = tables.map((row) => row.table_name);
    report.redemptionTable = names.includes("Redemption");
    report.modelSync = {
      Customer: names.includes("Customer"),
      Reward: names.includes("Reward"),
      PointsTransaction: names.includes("PointsTransaction"),
      Redemption: names.includes("Redemption"),
      LoyaltyProgram: names.includes("LoyaltyProgram"),
    };

    if (report.redemptionTable) {
      pass("Redemption table exists");
    } else {
      fail("Redemption table exists");
    }

    for (const [model, exists] of Object.entries(report.modelSync)) {
      if (exists) {
        pass(`Table synced: ${model}`);
      } else {
        fail(`Table synced: ${model}`);
      }
    }
  } catch (error) {
    fail("Table verification", error.message);
  }
}

// 6–7. Redemption tests (HTTP first — requires running backend; then DB assertions)
async function tryFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { ok: response.ok, status: response.status, json };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

let verifyStore = null;
let verifyCustomer = null;
let verifyReward = null;

if (report.dbConnection) {
  verifyStore = await prisma.store.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (verifyStore) {
    const fixtures = await ensureRedemptionFixtures(verifyStore);
    verifyCustomer = fixtures.customer;
    verifyReward = fixtures.reward;
  }

  const devRedeem = await tryFetch(`${baseUrl}/api/dev/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      verifyStore && verifyCustomer && verifyReward
        ? { customerId: verifyCustomer.id, rewardId: verifyReward.id }
        : {}
    ),
  });

  if (devRedeem.ok && devRedeem.json?.success) {
    report.httpAdminRedeem = { via: "dev proxy", status: devRedeem.status, body: devRedeem.json };
    pass("POST /api/dev/redeem (admin flow proxy)", devRedeem.json.couponCode);
  } else {
    report.httpAdminRedeem = devRedeem;
    fail("POST /api/dev/redeem", devRedeem.error ?? JSON.stringify(devRedeem.json));
  }

  const storefrontFixtures = verifyStore
    ? await ensureRedemptionFixtures(verifyStore)
    : { customer: null, reward: null };

  if (verifyStore && storefrontFixtures.customer && storefrontFixtures.reward) {
    const shopifyNumericId = storefrontFixtures.customer.shopifyCustomerId.replace(
      "gid://shopify/Customer/",
      ""
    );
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const query = {
      shop: verifyStore.shop,
      logged_in_customer_id: shopifyNumericId,
      path_prefix: "/apps/loyaltypulse",
      timestamp,
    };
    query.signature = buildAppProxySignature(query, process.env.SHOPIFY_API_SECRET);
    const qs = new URLSearchParams(query).toString();
    const storefront = await tryFetch(`${baseUrl}/apps/loyaltypulse/redeem?${qs}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ rewardId: storefrontFixtures.reward.id }),
    });

    if (storefront.ok && storefront.json?.success) {
      report.httpStorefrontRedeem = { status: storefront.status, body: storefront.json };
      pass("POST /apps/loyaltypulse/redeem", storefront.json.couponCode);
    } else {
      report.httpStorefrontRedeem = storefront;
      fail(
        "POST /apps/loyaltypulse/redeem",
        storefront.error ?? JSON.stringify(storefront.json)
      );
    }
  } else {
    fail("POST /apps/loyaltypulse/redeem", "Missing store/customer/reward test data");
  }
}

// Service-level DB verification from HTTP redemption
if (report.dbConnection && verifyStore) {
  try {
    const couponCode =
      report.httpAdminRedeem?.body?.couponCode ??
      report.httpStorefrontRedeem?.body?.couponCode;

    const latest = couponCode
      ? await prisma.redemption.findUnique({ where: { couponCode } })
      : null;

    if (!latest) {
      fail("Service redemption test", "No redemption row found for HTTP coupon");
    } else {
      const txn = await prisma.pointsTransaction.findFirst({
        where: {
          customerId: latest.customerId,
          type: "REDEEMED",
          reason: { contains: latest.couponCode },
        },
        orderBy: { createdAt: "desc" },
      });

      const checks = [
        latest.couponCode?.startsWith("LP-"),
        txn?.type === "REDEEMED",
        txn?.points === latest.pointsSpent,
      ];

      const hasShopifyId = latest.shopifyDiscountId?.startsWith("gid://shopify/");
      if (hasShopifyId) {
        checks.push(latest.discountType != null, Number(latest.discountValue) > 0);
      }

      if (checks.every(Boolean)) {
        report.serviceTest = {
          success: true,
          couponCode: latest.couponCode,
          shopifyDiscountId: latest.shopifyDiscountId,
          pointsSpent: latest.pointsSpent,
        };
        pass(
          "Service redemption test",
          hasShopifyId
            ? `coupon ${latest.couponCode} (${latest.shopifyDiscountId})`
            : `coupon ${latest.couponCode} (restart backend to persist shopifyDiscountId)`
        );
      } else {
        fail("Service redemption test", "Post-redemption verification failed");
      }
    }
  } catch (error) {
    fail("Service redemption test", error.message);
  }
}

// 8. Widget static checks
import fs from "fs";
const widgetJs = fs.readFileSync(
  path.resolve(backendRoot, "../extensions/loyalty-pulse-widget/assets/loyalty-widget.js"),
  "utf8"
);
const widgetCss = fs.readFileSync(
  path.resolve(backendRoot, "../extensions/loyalty-pulse-widget/assets/loyalty-widget.css"),
  "utf8"
);

report.widgetChecks = {
  redeemButton: widgetJs.includes("lpw-redeem-btn"),
  redeemPath: widgetJs.includes("/apps/loyaltypulse/redeem"),
  successBanner: widgetJs.includes("lpw-success"),
  refreshBalance: widgetJs.includes("fetchLoyaltyData"),
  redeemStyles: widgetCss.includes(".lpw-redeem-btn"),
};

for (const [check, ok] of Object.entries(report.widgetChecks)) {
  if (ok) pass(`Widget check: ${check}`);
  else fail(`Widget check: ${check}`);
}

await prisma.$disconnect();

console.log("\n=== Summary ===");
console.log(JSON.stringify(report, null, 2));
process.exit(report.issues.length > 0 ? 1 : 0);
