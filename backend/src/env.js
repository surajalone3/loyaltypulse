/**
 * Environment bootstrap — import this first in the backend entry point.
 */
import { loadEnvFile, validateEnv } from "./config/envConfig.js";

if (!globalThis.__loyaltypulseEnvLoaded) {
  const fileResult = loadEnvFile();
  if (fileResult.loaded) {
    console.log(`[env] Loaded ${fileResult.path}`);
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[env] No .env file at ${fileResult.path} — using process environment`);
  }

  const requireProduction = process.env.NODE_ENV === "production";
  validateEnv({ phase: "startup", requireProduction });

  globalThis.__loyaltypulseEnvLoaded = true;
}
