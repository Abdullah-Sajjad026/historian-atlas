/**
 * Enrich spine entities from Wikidata.
 *
 * Usage:
 *   DATABASE_URL=... npm run enrich              # all entities with a QID, not yet enriched
 *   DATABASE_URL=... npm run enrich -- --stale   # also refresh anything older than 30 days
 *   DATABASE_URL=... npm run enrich -- abbasid-caliphate tang-dynasty   # specific ids
 *
 * Behavior:
 *   - Sequential with a polite delay + descriptive User-Agent (Wikimedia etiquette).
 *   - Writes ONLY the `enrichment` JSONB + `enriched_at`; curated columns untouched.
 *   - Prints a WARNING when Wikidata's label doesn't resemble our curated name —
 *     that's the QID-typo tripwire; verify those rows by hand.
 *   - Needs egress to wikidata.org (run from your machine, not a sandboxed env).
 */

import postgres from "postgres";
import {
  parseEntity,
  entityDataUrl,
  labelLooksWrong,
} from "@/lib/enrich";

// Own client rather than the shared runtime one (src/db/client.ts): scripts
// prefer the DIRECT (unpooled) connection — against Neon, DATABASE_URL is
// the pooled string for the app and DIRECT_DATABASE_URL is for
// migrations/seed/enrich. Locally only DATABASE_URL is set; same behavior.
const DATABASE_URL =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://postgres:docker@localhost:5433/historian";
const client = postgres(DATABASE_URL, { max: 1 });

const USER_AGENT =
  "historian-atlas/0.1 (personal history-atlas project; enrichment script)";
const DELAY_MS = 350;
const STALE_DAYS = 30;

const args = process.argv.slice(2);
const refreshStale = args.includes("--stale");
const explicitIds = args.filter((a) => !a.startsWith("--"));

interface Target {
  table: "periods" | "people" | "events";
  id: string;
  name: string;
  qid: string;
}

async function collectTargets(): Promise<Target[]> {
  const staleClause = refreshStale
    ? `OR enriched_at < now() - interval '${STALE_DAYS} days'`
    : "";
  const targets: Target[] = [];
  for (const table of ["periods", "people", "events"] as const) {
    const rows = await client.unsafe(
      explicitIds.length
        ? `SELECT id, name, wikidata_qid FROM ${table}
           WHERE wikidata_qid IS NOT NULL AND id = ANY($1)`
        : `SELECT id, name, wikidata_qid FROM ${table}
           WHERE wikidata_qid IS NOT NULL
             AND (enriched_at IS NULL ${staleClause})`,
      explicitIds.length ? [explicitIds] : [],
    );
    for (const r of rows) {
      targets.push({ table, id: r.id, name: r.name, qid: r.wikidata_qid });
    }
  }
  return targets;
}

async function main() {
  const targets = await collectTargets();
  console.log(`Enriching ${targets.length} entities...`);
  let ok = 0,
    warned = 0,
    failed = 0;

  for (const t of targets) {
    try {
      const res = await fetch(entityDataUrl(t.qid), {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = parseEntity(t.qid, await res.json());

      if (labelLooksWrong(t.name, payload)) {
        console.warn(
          `  WARNING ${t.table}/${t.id}: curated "${t.name}" but ${t.qid} is labeled "${payload.label}" — check the QID.`,
        );
        warned++;
      }

      await client.unsafe(
        `UPDATE ${t.table} SET enrichment = $1, enriched_at = now() WHERE id = $2`,
        [JSON.stringify(payload), t.id],
      );
      ok++;
      console.log(`  ok ${t.table}/${t.id} <- ${t.qid} (${payload.label ?? "no label"})`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${t.table}/${t.id} (${t.qid}):`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Done: ${ok} enriched, ${warned} label warnings, ${failed} failed.`);
  await client.end();
}

main();
