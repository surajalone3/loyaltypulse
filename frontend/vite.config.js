import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse HOST / public app URL without throwing during `vite build`.
 * Accepts full URLs or bare hostnames (https:// is assumed).
 */
function resolvePublicHost(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }

  const trimmed = String(raw).trim().replace(/\/$/, "");
  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return null;
    }
    return parsed.origin;
  } catch {
    console.warn(`[vite] Ignoring invalid HOST value: ${JSON.stringify(raw)}`);
    return null;
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const isBuild = command === "build";
  const backendPort = env.PORT || "3000";
  const frontendPort = env.FRONTEND_PORT || "5173";
  const shopifyApiKey = env.VITE_SHOPIFY_API_KEY || env.SHOPIFY_API_KEY || "";

  const config = {
    plugins: [
      react(),
      {
        name: "html-env",
        transformIndexHtml(html) {
          return html.replace(/%VITE_SHOPIFY_API_KEY%/g, shopifyApiKey);
        },
      },
    ],
    envDir: path.resolve(__dirname, ".."),
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };

  // Dev server / HMR only — not used during Railway production build
  if (!isBuild) {
    const publicHost = resolvePublicHost(env.HOST);
    const tunnelHostname = publicHost
      ? new URL(publicHost).hostname
      : undefined;
    const appOrigin = publicHost || `http://localhost:${backendPort}`;

    config.server = {
      host: "127.0.0.1",
      port: parseInt(frontendPort, 10),
      strictPort: true,
      allowedHosts: true,
      origin: appOrigin,
      hmr: publicHost
        ? {
            protocol: "wss",
            host: tunnelHostname,
            clientPort: 443,
          }
        : {
            protocol: "ws",
            host: "127.0.0.1",
            port: parseInt(backendPort, 10),
            clientPort: parseInt(backendPort, 10),
          },
      proxy: {
        "/auth": {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
        "/api": {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    };
  }

  return config;
});
