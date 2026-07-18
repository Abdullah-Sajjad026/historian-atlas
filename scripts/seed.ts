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
  periodPeople,
  eventPeriods,
  themes,
  themeMemberships,
} from "@/db/schema";
import { spineModules, themeDefs } from "@content/spine/index";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Example:");
  console.error(
    "  DATABASE_URL=postgres://postgres:docker@localhost:5433/historian pnpm seed",
  );
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function main() {
  let counts = { periods: 0, people: 0, events: 0, links: 0, themes: 0 };

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
