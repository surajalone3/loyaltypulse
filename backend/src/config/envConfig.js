import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const envFilePath = path.join(repoRoot, ".env");

/**
 * Variables required at runtime (Railway / production).
 * `buildTime` = also required when running `npm run build`.
 */
export const ENV_SPECS = [
  {
    key: "DATABASE_URL",
    required: true,
    buildTime: false,
    source: "Railway PostgreSQL plugin → reference as DATABASE_URL, or external Postgres connection string",
    hint: "postgresql://user:pass@host:5432/dbname?schema=public",
  },
  {
    key: "SHOPIFY_API_KEY",
    required: true,
    requiredInDev: true,
    buildTime: false,
    source: "Shopify Partner Dashboard → App → Client credentials → API key",
  },
  {
    key: "SHOPIFY_API_SECRET",
    required: true,
    requiredInDev: true,
    buildTime: false,
    secret: true,
    source: "Shopify Partner Dashboard → App → Client credentials → API secret",
  },
  {
    key: "SHOPIFY_SCOPES",
    required: true,
    buildTime: false,
    source: "Shopify app scopes (must match shopify.app.toml)",
    hint: "read_orders,read_customers,write_discounts,write_app_proxy",
  },
  {
    key: "HOST",
    required: true,
    buildTime: false,
    source: "Railway service public domain, e.g. https://your-app.up.railway.app",
    validate: (value) => {
      if (!value.startsWith("https://")) {
        return "HOST must start with https:// in production";
      }
      if (/localhost|127\.0\.0\.1/i.test(value)) {
        return "HOST must not be localhost in production";
      }
      return null;
    },
  },
  {
    key: "NODE_ENV",
    required: false,
    buildTime: false,
    source: "Set to production on Railway",
    hint: "production",
  },
  {
    key: "PORT",
    required: false,
    buildTime: false,
    source: "Injected automatically by Railway — do not hardcode",
  },
  {
    key: "VITE_SHOPIFY_API_KEY",
    required: false,
    buildTime: true,
    source: "Same value as SHOPIFY_API_KEY — required at build time for embedded admin UI",
  },
];

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isSet(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Load monorepo .env when present (local dev). Railway injects vars directly.
 */
export function loadEnvFile() {
  if (!fs.existsSync(envFilePath)) {
    return { loaded: false, path: envFilePath };
  }

  const result = dotenv.config({ path: envFilePath });
  return {
    loaded: !result.error,
    path: envFilePath,
    error: result.error?.message,
  };
}

export function getEnvReport({ phase = "startup", requireProduction = false } = {}) {
  const production = isProduction() || requireProduction;
  const checkBuildVars = phase === "build" || phase === "verify";
  const missing = [];
  const invalid = [];
  const warnings = [];

  for (const spec of ENV_SPECS) {
    const raw = process.env[spec.key];
    const requiredNow =
      (production && spec.required && (!spec.buildTime || checkBuildVars)) ||
      (!production && spec.requiredInDev);

    if (requiredNow && !isSet(raw)) {
      missing.push(spec);
      continue;
    }

    if (isSet(raw) && spec.validate) {
      const error = spec.validate(String(raw).trim());
      if (error) {
        invalid.push({ spec, error });
      }
    }
  }

  if (production && !isSet(process.env.NODE_ENV)) {
    warnings.push("NODE_ENV is not set to production");
  } else if (production && process.env.NODE_ENV !== "production") {
    warnings.push(`NODE_ENV is "${process.env.NODE_ENV}" — expected "production" on Railway`);
  }

  if (production && !isSet(process.env.PORT)) {
    warnings.push("PORT is not set — Railway normally injects this automatically");
  }

  if (checkBuildVars) {
    const viteKey = process.env.VITE_SHOPIFY_API_KEY;
    const apiKey = process.env.SHOPIFY_API_KEY;
    if (!isSet(viteKey) && !isSet(apiKey)) {
      missing.push({
        key: "VITE_SHOPIFY_API_KEY",
        source: "Set to SHOPIFY_API_KEY for frontend build on Railway",
        hint: "Same as SHOPIFY_API_KEY",
      });
    }
  }

  if (production && isSet(process.env.DEV_MODE)) {
    const devMode = process.env.DEV_MODE.trim().toLowerCase();
    if (devMode === "true" || devMode === "1" || devMode === "yes") {
      warnings.push("DEV_MODE is enabled — automatic webhook registration is disabled");
    }
  }

  return { production, phase, missing, invalid, warnings, envFilePath };
}

export function formatEnvError(report) {
  const lines = [
    "",
    "══════════════════════════════════════════════════════════════",
    "  LoyaltyPulse startup failed — missing or invalid configuration",
    "══════════════════════════════════════════════════════════════",
    "",
  ];

  if (report.missing.length > 0) {
    lines.push("Missing required environment variables:");
    for (const spec of report.missing) {
      lines.push(`  • ${spec.key}`);
      if (spec.source) {
        lines.push(`    Source: ${spec.source}`);
      }
      if (spec.hint) {
        lines.push(`    Example: ${spec.hint}`);
      }
    }
    lines.push("");
  }

  if (report.invalid.length > 0) {
    lines.push("Invalid environment variables:");
    for (const { spec, error } of report.invalid) {
      lines.push(`  • ${spec.key}: ${error}`);
    }
    lines.push("");
  }

  lines.push("Railway: Project → Service → Variables");
  lines.push(`Local dev: copy .env.production.example → ${report.envFilePath}`);
  lines.push("══════════════════════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}

/**
 * @throws {Error} when required variables are missing or invalid
 */
export function validateEnv(options = {}) {
  loadEnvFile();
  const report = getEnvReport(options);
  const hasProblems = report.missing.length > 0 || report.invalid.length > 0;

  if (hasProblems) {
    throw new Error(formatEnvError(report));
  }

  if (report.production) {
    console.log("[env] Production configuration validated");
    for (const warning of report.warnings) {
      console.warn(`[env] Warning: ${warning}`);
    }
  } else {
    console.log("[env] Development configuration loaded");
    if (isSet(process.env.SHOPIFY_API_KEY)) {
      console.log("[env] SHOPIFY_API_KEY:", process.env.SHOPIFY_API_KEY);
    }
    if (isSet(process.env.SHOPIFY_API_SECRET)) {
      console.log("[env] SHOPIFY_API_SECRET: [set]");
    }
  }

  return report;
}

export { repoRoot, envFilePath };
