import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations must run against a DIRECT (unpooled) connection — DDL +
  // advisory locks through a transaction pooler (Neon's -pooler host) is
  // unreliable. Locally the two are the same DB, so DATABASE_URL suffices.
  dbCredentials: {
    url: (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)!,
  },
});
