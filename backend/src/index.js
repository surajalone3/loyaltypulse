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
import { embeddedAppHeaders } from "./middleware/embeddedAppHeaders.js";

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
app.use("/api", apiRoutes);

if (isDev) {
  const viteProxy = createProxyMiddleware({
    target: viteTarget,
    changeOrigin: false,
    ws: true,
    xfwd: true,
    pathFilter: (pathname) =>
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api"),
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
    console.log(`Public app URL (HOST): ${process.env.HOST}`);
    console.log(`Proxy chain: browser → :${PORT} (Express) → ${viteTarget} (Vite)`);
    console.log(`Start Vite first: npm run dev:frontend`);
  }
});
