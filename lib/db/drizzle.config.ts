import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
});
