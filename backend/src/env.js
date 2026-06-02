import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

if (!globalThis.__loyaltypulseEnvLoaded) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const envPath = path.resolve(__dirname, "../../.env");
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.warn(`[env] Could not load ${envPath}:`, result.error.message);
  }

  console.log("SHOPIFY_API_KEY:", process.env.SHOPIFY_API_KEY);
  console.log("SHOPIFY_API_SECRET:", process.env.SHOPIFY_API_SECRET);

  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
    throw new Error(
      `Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET. Expected .env at: ${envPath}`
    );
  }

  globalThis.__loyaltypulseEnvLoaded = true;
}
