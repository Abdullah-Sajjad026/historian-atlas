/**
 * Postgres client singleton. Next.js dev mode hot-reloads modules, which
 * would otherwise leak a connection pool per reload — stash on globalThis.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:docker@localhost:5433/historian";

/** Hosted Postgres (Neon) requires TLS; local docker does not. Detected from
 *  the URL itself, or forced with DATABASE_SSL=true for URLs without the
 *  query param. All env reads here are runtime-only — the build never opens
 *  a connection (postgres.js connects lazily, and every page is
 *  force-dynamic), so `next build` stays DB-free. */
const wantsSsl =
  DATABASE_URL.includes("sslmode=require") ||
  process.env.DATABASE_SSL === "true";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

export const client =
  globalForDb.pgClient ??
  postgres(DATABASE_URL, {
    /** On Vercel each lambda instance is its own process, so a "pool" of 1
     *  per instance is the whole budget — Neon's pooler (the -pooler host in
     *  DATABASE_URL there) does the multiplexing. Locally the dev server and
     *  preview scripts share one process and keep a small real pool. */
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20, // seconds — release idle conns fast between invocations
    connect_timeout: 10,
    ...(wantsSsl ? { ssl: "require" as const } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client);
