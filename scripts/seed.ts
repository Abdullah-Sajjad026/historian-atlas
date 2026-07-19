/**
 * Seed the database from the curated spine.
 *
 * Idempotent by design: every write is an UPSERT keyed on slug, so re-running
 * after editing content files is the normal workflow (`pnpm seed`). Enrichment
 * columns are never touched here — curation and enrichment stay independent.
 *
 * Usage: DATABASE_URL=postgres://... pnpm seed
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  periods,
  people,
  events,
  links,
  periodPeople,
  eventPeriods,
  themes,
  themeMemberships,
} from "@/db/schema";
import { spineModules, themeDefs } from "@content/spine/index";
import type {
  SpineLink,
  SpineLinkEndpoint,
  SpineModule,
} from "@content/spine/types";

// Scripts prefer the DIRECT (unpooled) connection when one is configured —
// against Neon, DATABASE_URL is the pooled string for the app runtime and
// DIRECT_DATABASE_URL is for migrations/seed/enrich. Locally only
// DATABASE_URL is set and nothing changes.
const DATABASE_URL =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Example:");
  console.error(
    "  DATABASE_URL=postgres://postgres:docker@localhost:5433/historian pnpm seed",
  );
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Link lint — the DB deliberately doesn't enforce the endpoint rules (entity
// refs aren't FKs so links can cross modules in any order), so the seed does:
//  - each endpoint is (type+id) XOR (lat+lng+label) — the spine types make
//    this structural, but re-check at runtime for anything the compiler
//    can't see (hand-built objects, future JSON sources);
//  - entity refs must resolve somewhere in the spine — a dangling id FAILS
//    the whole seed loudly;
//  - an endpoint that resolves but has no coordinates (person without a
//    place, period without a heartland) only WARNS: the link seeds, the
//    globe skips it (resolveEndpoints returns null), nothing crashes.
// ---------------------------------------------------------------------------

function lintLinks(mods: SpineModule[]): SpineLink[] {
  const coords = {
    period: new Map(
      mods
        .flatMap((m) => m.periods)
        .map((p) => [p.id, p.centerLat != null && p.centerLng != null]),
    ),
    person: new Map(
      mods
        .flatMap((m) => m.people)
        .map((p) => [p.id, p.lat != null && p.lng != null]),
    ),
    event: new Map(
      mods
        .flatMap((m) => m.events)
        .map((e) => [e.id, e.lat != null && e.lng != null]),
    ),
  };

  const all = mods.flatMap((m) => m.links ?? []);
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const link of all) {
    if (seen.has(link.id)) errors.push(`${link.id}: duplicate link id`);
    seen.add(link.id);

    for (const [side, ep] of [
      ["a", link.a],
      ["b", link.b],
    ] as const) {
      const isRef = "type" in ep && "id" in ep;
      const isLiteral = "lat" in ep && "lng" in ep && "label" in ep;
      if (isRef === isLiteral) {
        errors.push(
          `${link.id} endpoint ${side}: must be (type+id) XOR (lat+lng+label)`,
        );
        continue;
      }
      if (isRef) {
        const known = coords[ep.type];
        if (!known.has(ep.id)) {
          errors.push(
            `${link.id} endpoint ${side}: dangling ${ep.type} ref '${ep.id}'`,
          );
        } else if (!known.get(ep.id)) {
          console.warn(
            `WARN ${link.id} endpoint ${side}: ${ep.type} '${ep.id}' has no coordinates — link will be skipped on the globe`,
          );
        }
      }
    }
  }

  if (errors.length) {
    throw new Error(`Link lint failed:\n  ${errors.join("\n  ")}`);
  }
  return all;
}

/** Flatten one endpoint into its five nullable columns (a_* or b_*). */
function endpointRow(side: "a" | "b", ep: SpineLinkEndpoint) {
  const ref = "type" in ep ? ep : null;
  const lit = "lat" in ep ? ep : null;
  return {
    [`${side}Type`]: ref?.type ?? null,
    [`${side}Id`]: ref?.id ?? null,
    [`${side}Lat`]: lit?.lat ?? null,
    [`${side}Lng`]: lit?.lng ?? null,
    [`${side}Label`]: lit?.label ?? null,
  };
}

async function main() {
  let counts = {
    periods: 0,
    people: 0,
    events: 0,
    links: 0,
    connections: 0,
    themes: 0,
  };

  // Lint BEFORE the transaction: a dangling link ref aborts the seed before
  // any write happens.
  const allLinks = lintLinks(spineModules);

  await db.transaction(async (tx) => {
    // Themes first — memberships reference them.
    for (const t of themeDefs) {
      await tx
        .insert(themes)
        .values(t)
        .onConflictDoUpdate({
          target: themes.id,
          set: {
            name: t.name,
            description: t.description,
            calendarMode: t.calendarMode,
          },
        });
      counts.themes++;
    }

    for (const mod of spineModules) {
      // Periods: two passes so parentId references resolve regardless of
      // declaration order within a module.
      for (const p of mod.periods) {
        const { parentId, ...values } = p;
        await tx
          .insert(periods)
          .values(values)
          .onConflictDoUpdate({ target: periods.id, set: values });
        counts.periods++;
      }
      for (const p of mod.periods) {
        if (p.parentId) {
          await tx
            .update(periods)
            .set({ parentId: p.parentId })
            .where(sql`${periods.id} = ${p.id}`);
        }
      }

      for (const person of mod.people) {
        const { periods: memberships, ...values } = person;
        await tx
          .insert(people)
          .values(values)
          .onConflictDoUpdate({ target: people.id, set: values });
        counts.people++;

        for (const m of memberships) {
          await tx
            .insert(periodPeople)
            .values({ periodId: m.periodId, personId: person.id, role: m.role })
            .onConflictDoNothing();
          counts.links++;
        }
      }

      for (const ev of mod.events) {
        const { periodIds, ...values } = ev;
        await tx
          .insert(events)
          .values(values)
          .onConflictDoUpdate({ target: events.id, set: values });
        counts.events++;

        for (const periodId of periodIds) {
          await tx
            .insert(eventPeriods)
            .values({ eventId: ev.id, periodId })
            .onConflictDoNothing();
          counts.links++;
        }
      }

      // Theme memberships
      for (const [themeId, members] of Object.entries(
        mod.themeMemberships ?? {},
      )) {
        const rows = [
          ...(members.periods ?? []).map((id) => ({
            themeId,
            entityType: "period" as const,
            entityId: id,
          })),
          ...(members.people ?? []).map((id) => ({
            themeId,
            entityType: "person" as const,
            entityId: id,
          })),
          ...(members.events ?? []).map((id) => ({
            themeId,
            entityType: "event" as const,
            entityId: id,
          })),
        ];
        for (const row of rows) {
          await tx.insert(themeMemberships).values(row).onConflictDoNothing();
          counts.links++;
        }
      }
    }

    // Connections last, after every module's entities exist. Endpoint refs
    // aren't FKs, so this is convention (mirrors the lint), not a constraint.
    for (const link of allLinks) {
      const row = {
        id: link.id,
        kind: link.kind,
        ...endpointRow("a", link.a),
        ...endpointRow("b", link.b),
        startYear: link.startYear,
        endYear: link.endYear ?? null,
        certainty: link.certainty ?? ("exact" as const),
        importance: link.importance ?? 3,
        summary: link.summary,
        groupId: link.groupId ?? null,
        wikidataQid: link.wikidataQid ?? null,
      };
      await tx
        .insert(links)
        .values(row)
        .onConflictDoUpdate({ target: links.id, set: row });
      counts.connections++;
    }
  });

  console.log("Seed complete:", counts);

  // Smoke-test the core query — the whole point of the schema.
  const slice = await client`
    SELECT id, name, start_year, end_year
    FROM periods WHERE year_range @> 800::int
    ORDER BY importance ASC`;
  console.log(
    "Time-slice check (world in 800 CE):",
    slice.map((r) => r.name),
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
