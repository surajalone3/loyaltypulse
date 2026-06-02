import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const backendPort = env.PORT || "3000";
  const frontendPort = env.FRONTEND_PORT || "5173";
  const publicHost = env.HOST?.replace(/\/$/, "");
  const tunnelHostname = publicHost
    ? new URL(publicHost).hostname
    : undefined;

  // URL the browser uses to load the app (Express on :3000 or ngrok → Express)
  const appOrigin =
    publicHost || `http://localhost:${backendPort}`;

  return {
    plugins: [
      react(),
      {
        name: "html-env",
        transformIndexHtml(html) {
          return html.replace(
            /%VITE_SHOPIFY_API_KEY%/g,
            env.VITE_SHOPIFY_API_KEY || ""
          );
        },
      },
    ],
    envDir: path.resolve(__dirname, ".."),
    server: {
      host: "127.0.0.1",
      port: parseInt(frontendPort, 10),
      strictPort: true,
      // Express proxy may send Host: localhost:5173 or tunnel host — allow all in dev
      allowedHosts: true,
      // Asset URLs when served through Express (:3000) or ngrok
      origin: appOrigin,
      // HMR WebSocket goes through Express (same port as the page), not back to :5173
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
      // Only used when opening Vite directly at :5173 (not via Express proxy)
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
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
