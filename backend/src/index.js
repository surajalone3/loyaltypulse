import "./env.js";

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import compression from "compression";
import serveStatic from "serve-static";
import { createProxyMiddleware } from "http-proxy-middleware";

import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import webhooksRoutes from "./routes/webhooks.js";
import devRoutes from "./routes/dev.js";
import storefrontRoutes from "./routes/storefront.js";
import { embeddedAppHeaders } from "./middleware/embeddedAppHeaders.js";
import {
  getOrdersPaidWebhookUrl,
  isDevModeEnabled,
} from "./services/registerWebhooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const isDev = process.env.NODE_ENV !== "production";
const frontendPort = process.env.FRONTEND_PORT ?? "5173";
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

// Use IPv4 explicitly (Node 17+ may resolve "localhost" to ::1)
const viteTarget = `http://127.0.0.1:${frontendPort}`;

const app = express();

app.set("trust proxy", 1);

app.use(embeddedAppHeaders);

// Compression breaks Vite dev streaming/HMR — production only
if (!isDev) {
  app.use(compression());
}

// Webhooks require raw body for HMAC verification (before express.json())
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  webhooksRoutes
);

app.use(express.json());

if (isDev) {
  app.use(
    cors({
      origin: [
        `http://localhost:${frontendPort}`,
        `http://127.0.0.1:${frontendPort}`,
        `http://localhost:${PORT}`,
        process.env.HOST?.replace(/\/$/, ""),
      ].filter(Boolean),
      credentials: true,
    })
  );
}

app.use("/auth", authRoutes);

// Log every app proxy hit before routing (diagnostics for tunnel issues)
app.use("/apps/loyaltypulse", (req, _res, next) => {
  console.log("[app-proxy:entry]", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    shop: req.query.shop ?? null,
    ngrokSkipHeader: req.get("ngrok-skip-browser-warning") ?? null,
  });
  next();
});

// Storefront app proxy (Theme App Extension widget)
app.use("/apps/loyaltypulse", storefrontRoutes);

if (isDev) {
  app.use("/api/dev", devRoutes);
}

app.use("/api", apiRoutes);

if (isDev) {
  const viteProxy = createProxyMiddleware({
    target: viteTarget,
    changeOrigin: false,
    ws: true,
    xfwd: true,
    pathFilter: (pathname) =>
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/apps"),
    on: {
      proxyReq: (proxyReq) => {
        // Vite must see a Host it accepts (not 127.0.0.1 when allowedHosts is restricted)
        proxyReq.setHeader("Host", `localhost:${frontendPort}`);
        proxyReq.setHeader("ngrok-skip-browser-warning", "true");
      },
      error: (err, req, res) => {
        console.error(
          `[proxy] Cannot reach Vite at ${viteTarget} — run: npm run dev:frontend`,
          err.code ?? err.message
        );
        if (res && typeof res.writeHead === "function" && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(
            `Vite dev server is not running at ${viteTarget}.\n` +
              `Start it with: npm run dev:frontend\n` +
              `Then reload this page.`
          );
        }
      },
    },
  });

  app.use(viteProxy);
} else {
  app.use(serveStatic(frontendDist, { index: false }));

  app.get("/*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`LoyaltyPulse backend listening on port ${PORT}`);
  if (isDev) {
    const host = process.env.HOST?.replace(/\/$/, "");
    console.log(`Public app URL (HOST): ${host ?? "(set HOST in .env)"}`);
    if (host) {
      console.log(`App proxy health check: ${host}/apps/loyaltypulse/health`);
      console.log(
        `  curl -H "ngrok-skip-browser-warning: true" ${host}/apps/loyaltypulse/health`
      );
    }
    console.log(`Proxy chain: browser → :${PORT} (Express) → ${viteTarget} (Vite)`);
    console.log(`Start Vite first: npm run dev:frontend`);
    console.log(`App Proxy dev: npm run dev:shopify (Cloudflare tunnel — recommended)`);
    console.log(`Dev loyalty trigger: POST http://localhost:${PORT}/api/dev/process-order`);
    const webhookUrl = getOrdersPaidWebhookUrl();
    if (webhookUrl) {
      console.log(`Orders/paid webhook URL: ${webhookUrl}`);
    }
    if (isDevModeEnabled()) {
      console.warn(
        "[startup] DEV_MODE=true — automatic orders/paid webhook registration is DISABLED. " +
          "Real storefront orders will NOT create Customer records unless you register the webhook manually " +
          "or set DEV_MODE=false and re-run OAuth."
      );
    }
  }
});
