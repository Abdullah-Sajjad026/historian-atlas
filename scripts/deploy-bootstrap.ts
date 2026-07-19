/**
 * Production bootstrap: db:migrate + seed against the DIRECT (unpooled)
 * connection string.
 *
 * Usage: DIRECT_DATABASE_URL=postgres://...@ep-xxx.region.aws.neon.tech/... \
 *          npm run deploy:bootstrap
 *
 * DIRECT_DATABASE_URL is REQUIRED here, no DATABASE_URL fallback: in a
 * deployed setup DATABASE_URL is the POOLED string, and running migrations
 * through a transaction pooler is unreliable (drizzle-kit takes advisory
 * locks and issues DDL, both of which assume one real session — a pooler can
 * hand statements to different backend connections). Failing loudly beats a
 * silently half-applied migration.
 */
import { execSync } from "node:child_process";

if (!process.env.DIRECT_DATABASE_URL) {
  console.error("deploy:bootstrap requires DIRECT_DATABASE_URL (the UNPOOLED");
  console.error("Neon connection string — the host WITHOUT '-pooler').");
  console.error("Refusing to fall back to DATABASE_URL: in production that is");
  console.error("the pooled string, and migrations through a pooler are unsafe.");
  console.error("");
  console.error("  DIRECT_DATABASE_URL=postgres://... npm run deploy:bootstrap");
  process.exit(1);
}

// drizzle.config.ts and scripts/seed.ts both prefer DIRECT_DATABASE_URL when
// present, so plain sub-invocations inherit the right connection.
for (const cmd of ["npm run db:migrate", "npm run seed"]) {
  console.log(`\n== ${cmd} ==`);
  execSync(cmd, { stdio: "inherit" });
}
