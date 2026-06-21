/**
 * Verifies loyalty program settings persistence (GET/PUT service layer + DB).
 * Usage: npm run verify:settings
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  getLoyaltySettings,
  updateLoyaltySettings,
  LoyaltySettingsError,
} from "../src/services/loyaltySettings.js";

const prisma = new PrismaClient();

const TEST_SHOP = process.env.VERIFY_SHOP || "loyaltypulse-test.myshopify.com";

async function main() {
  console.log("=== Loyalty Program Settings Verification ===\n");

  const store = await prisma.store.findUnique({
    where: { shop: TEST_SHOP },
    include: { loyaltyProgram: true },
  });

  if (!store) {
    throw new Error(`Store not found for shop: ${TEST_SHOP}`);
  }

  console.log(`Store: ${store.shop} (${store.id})`);

  const original = await getLoyaltySettings(store);
  console.log("\n1. GET settings (current):");
  console.log(JSON.stringify(original, null, 2));

  const testPayload = {
    programName: "TestStars",
    pointsPerDollar: 12,
    welcomeBonus: 150,
    referralBonus: 300,
    reviewRequestDelayDays: original.reviewRequestDelayDays,
    reviewRequestsEnabled: original.reviewRequestsEnabled,
    programEnabled: true,
  };

  console.log("\n2. PUT settings (test values):");
  const updated = await updateLoyaltySettings(store, testPayload);
  console.log(JSON.stringify(updated, null, 2));

  const reloaded = await getLoyaltySettings(store);
  console.log("\n3. GET settings (after save):");
  console.log(JSON.stringify(reloaded, null, 2));

  const dbRow = await prisma.loyaltyProgram.findUnique({
    where: { storeId: store.id },
  });

  console.log("\n4. Database row:");
  console.log(
    JSON.stringify(
      {
        programName: dbRow.programName,
        pointsPerDollar: dbRow.pointsPerDollar,
        welcomeBonus: dbRow.welcomeBonus,
        referralBonus: dbRow.referralBonus,
        isActive: dbRow.isActive,
        pointsName: dbRow.pointsName,
      },
      null,
      2
    )
  );

  const assertions = [
    ["programName", reloaded.programName, testPayload.programName],
    ["pointsPerDollar", reloaded.pointsPerDollar, testPayload.pointsPerDollar],
    ["welcomeBonus", reloaded.welcomeBonus, testPayload.welcomeBonus],
    ["referralBonus", reloaded.referralBonus, testPayload.referralBonus],
    ["programEnabled", reloaded.programEnabled, testPayload.programEnabled],
    ["db.programName", dbRow.programName, testPayload.programName],
    ["db.pointsName", dbRow.pointsName, "teststars"],
  ];

  console.log("\n5. Assertions:");
  let failed = 0;
  for (const [label, actual, expected] of assertions) {
    const pass = actual === expected;
    console.log(`  ${pass ? "✓" : "✗"} ${label}: ${actual} ${pass ? "" : `(expected ${expected})`}`);
    if (!pass) failed += 1;
  }

  console.log("\n6. Validation (expect failure):");
  try {
    await updateLoyaltySettings(store, {
      programName: "",
      pointsPerDollar: 0,
      welcomeBonus: -1,
      referralBonus: -1,
      programEnabled: "yes",
    });
    console.log("  ✗ Should have thrown validation error");
    failed += 1;
  } catch (err) {
    if (err instanceof LoyaltySettingsError) {
      console.log(`  ✓ Validation rejected invalid payload: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n7. Restore original settings:");
  const restored = await updateLoyaltySettings(store, {
    programName: original.programName,
    pointsPerDollar: original.pointsPerDollar,
    welcomeBonus: original.welcomeBonus,
    referralBonus: original.referralBonus,
    reviewRequestDelayDays: original.reviewRequestDelayDays,
    reviewRequestsEnabled: original.reviewRequestsEnabled,
    programEnabled: original.programEnabled,
  });
  console.log(JSON.stringify(restored, null, 2));

  if (failed > 0) {
    throw new Error(`${failed} assertion(s) failed`);
  }

  console.log("\n=== All settings checks passed ===");
}

main()
  .catch((err) => {
    console.error("\nVerification failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
