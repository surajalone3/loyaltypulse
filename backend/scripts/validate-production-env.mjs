#!/usr/bin/env node
/**
 * Pre-start validation for Railway / production (npm prestart hook).
 */
import { validateEnv } from "../src/config/envConfig.js";

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  console.log("[validate-production-env] Skipped (NODE_ENV is not production)");
  process.exit(0);
}

try {
  validateEnv({ phase: "startup", requireProduction: true });
  console.log("[validate-production-env] OK");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
