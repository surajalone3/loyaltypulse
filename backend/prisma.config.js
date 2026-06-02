import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load monorepo root .env (DATABASE_URL, etc.)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
