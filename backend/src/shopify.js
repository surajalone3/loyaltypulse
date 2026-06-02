import "./env.js";

import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, LogSeverity } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hostUrl = process.env.HOST?.replace(/\/$/, "") ?? "";
const hostName = hostUrl.replace(/https?:\/\//, "") || "localhost";

if (!hostUrl || hostName.includes("localhost")) {
  console.warn(
    "[shopify] HOST must be your public tunnel URL (e.g. https://xxx.ngrok-free.dev), not localhost, or Shopify Admin cannot load the embedded app."
  );
}

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") ?? [],
  hostName,
  hostScheme: hostUrl.startsWith("https") ? "https" : "http",
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  logger: {
    level:
      process.env.NODE_ENV === "production"
        ? LogSeverity.Error
        : LogSeverity.Info,
  },
  sessionStorage: new PrismaSessionStorage(prisma),
});

export { prisma };
