/**
 * Postgres client singleton. Next.js dev mode hot-reloads modules, which
 * would otherwise leak a connection pool per reload — stash on globalThis.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:docker@localhost:5433/historian";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

export const client =
  globalForDb.pgClient ?? postgres(DATABASE_URL, { max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client);
