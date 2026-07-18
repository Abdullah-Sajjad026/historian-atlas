/**
 * Query layer. Pages never touch SQL directly — every read goes through a
 * named, typed function here. The time-slice query (the app's core primitive)
 * is defined once and reused by every "meanwhile" surface.
 */

import { client } from "./client";
import type { Region } from "./schema";
import type { EnrichmentPayload } from "@/lib/enrich";

export interface PeriodRow {
  id: string;
  name: string;
  kind: string;
  start_year: number;
  end_year: number | null;
  start_certainty: "exact" | "circa" | "disputed" | "unknown";
  end_certainty: "exact" | "circa" | "disputed" | "unknown";
  region: Region;
  parent_id: string | null;
  importance: number;
  summary: string | null;
  /** Present only on detail queries; curated fields always win at render. */
  enrichment?: EnrichmentPayload | null;
}

export interface PersonRow {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birth_certainty: "exact" | "circa" | "disputed" | "unknown";
  death_certainty: "exact" | "circa" | "disputed" | "unknown";
  importance: number;
  influence: string | null;
  summary: string | null;
}

export interface EventRow {
  id: string;
  name: string;
  start_year: number;
  end_year: number | null;
  certainty: "exact" | "circa" | "disputed" | "unknown";
  region: Region;
  importance: number;
  summary: string | null;
}

// ---------------------------------------------------------------------------
// The core primitive: what existed in year T?
// ---------------------------------------------------------------------------

export interface TimeSlice {
  year: number;
  periods: PeriodRow[];
  events: EventRow[];
}

/**
 * "The world in year T." Excludes the given period (an entity page doesn't
 * list itself in its own meanwhile rail).
 */
export async function getTimeSlice(
  year: number,
  excludePeriodId?: string,
): Promise<TimeSlice> {
  const periods = await client<PeriodRow[]>`
    SELECT id, name, kind, start_year, end_year, start_certainty, end_certainty,
           region, parent_id, importance, summary
    FROM periods
    WHERE year_range @> ${year}::int
      AND id <> ${excludePeriodId ?? ""}
    ORDER BY importance ASC, region ASC`;

  // Events within a ±25y window around T — a "moment" at historical zoom.
  const events = await client<EventRow[]>`
    SELECT id, name, start_year, end_year, certainty, region, importance, summary
    FROM events
    WHERE year_range && int4range(${year - 25}::int, ${year + 25}::int, '[]')
    ORDER BY start_year ASC`;

  return { year, periods, events };
}

// ---------------------------------------------------------------------------
// Listing + detail reads
// ---------------------------------------------------------------------------

export async function getAllPeriods(): Promise<PeriodRow[]> {
  return client<PeriodRow[]>`
    SELECT id, name, kind, start_year, end_year, start_certainty, end_certainty,
           region, parent_id, importance, summary
    FROM periods ORDER BY start_year ASC`;
}

export interface PeriodDetail {
  period: PeriodRow;
  parent: PeriodRow | null;
  successors: PeriodRow[];
  people: Array<PersonRow & { role: string }>;
  events: EventRow[];
  /**
   * Concurrent world by RANGE OVERLAP, not point sample. A midpoint sample
   * misses real overlaps (Abbasids' midpoint is 1004 — after Tang, before
   * the Mongols — despite 157 shared years with the Tang). Excludes this
   * period itself and events already listed on the page.
   */
  concurrent: { periods: PeriodRow[]; events: EventRow[] };
}

export async function getPeriodDetail(
  id: string,
): Promise<PeriodDetail | null> {
  const rows = await client<PeriodRow[]>`
    SELECT id, name, kind, start_year, end_year, start_certainty, end_certainty,
           region, parent_id, importance, summary, enrichment
    FROM periods WHERE id = ${id}`;
  const period = rows[0];
  if (!period) return null;

  const [parent, successors, people, events] = await Promise.all([
    period.parent_id
      ? client<PeriodRow[]>`
          SELECT id, name, kind, start_year, end_year, start_certainty,
                 end_certainty, region, parent_id, importance, summary
          FROM periods WHERE id = ${period.parent_id}`.then((r) => r[0] ?? null)
      : Promise.resolve(null),
    client<PeriodRow[]>`
      SELECT id, name, kind, start_year, end_year, start_certainty,
             end_certainty, region, parent_id, importance, summary
      FROM periods WHERE parent_id = ${id} ORDER BY start_year ASC`,
    client<Array<PersonRow & { role: string }>>`
      SELECT p.id, p.name, p.birth_year, p.death_year, p.birth_certainty,
             p.death_certainty, p.importance, p.influence, p.summary, pp.role
      FROM people p
      JOIN period_people pp ON pp.person_id = p.id
      WHERE pp.period_id = ${id}
      ORDER BY p.importance ASC, p.birth_year ASC NULLS LAST`,
    client<EventRow[]>`
      SELECT e.id, e.name, e.start_year, e.end_year, e.certainty, e.region,
             e.importance, e.summary
      FROM events e
      JOIN event_periods ep ON ep.event_id = e.id
      WHERE ep.period_id = ${id}
      ORDER BY e.start_year ASC`,
  ]);

  // Range overlap (&&): every period sharing at least one year with this one.
  const concurrentPeriods = await client<PeriodRow[]>`
    SELECT p.id, p.name, p.kind, p.start_year, p.end_year, p.start_certainty,
           p.end_certainty, p.region, p.parent_id, p.importance, p.summary
    FROM periods p, periods me
    WHERE me.id = ${id}
      AND p.id <> me.id
      AND p.year_range && me.year_range
    ORDER BY p.importance ASC, p.start_year ASC`;

  // Events during this period's span that are NOT already on the page
  // (i.e., not linked to this period via event_periods).
  const concurrentEvents = await client<EventRow[]>`
    SELECT e.id, e.name, e.start_year, e.end_year, e.certainty, e.region,
           e.importance, e.summary
    FROM events e, periods me
    WHERE me.id = ${id}
      AND e.year_range && me.year_range
      AND NOT EXISTS (
        SELECT 1 FROM event_periods ep
        WHERE ep.event_id = e.id AND ep.period_id = me.id)
    ORDER BY e.start_year ASC`;

  return {
    period,
    parent,
    successors,
    people,
    events,
    concurrent: { periods: concurrentPeriods, events: concurrentEvents },
  };
}

export interface PersonDetail {
  person: PersonRow;
  memberships: Array<{ role: string } & PeriodRow>;
  /** Concurrent world, sampled at the person's mid-life. */
  meanwhile: TimeSlice | null;
}

export async function getPersonDetail(
  id: string,
): Promise<PersonDetail | null> {
  const rows = await client<PersonRow[]>`
    SELECT id, name, birth_year, death_year, birth_certainty, death_certainty,
           importance, influence, summary
    FROM people WHERE id = ${id}`;
  const person = rows[0];
  if (!person) return null;

  const memberships = await client<Array<{ role: string } & PeriodRow>>`
    SELECT pp.role, p.id, p.name, p.kind, p.start_year, p.end_year,
           p.start_certainty, p.end_certainty, p.region, p.parent_id,
           p.importance, p.summary
    FROM periods p
    JOIN period_people pp ON pp.period_id = p.id
    WHERE pp.person_id = ${id}
    ORDER BY p.start_year ASC`;

  const meanwhile =
    person.birth_year !== null
      ? await getTimeSlice(
          Math.round((person.birth_year + (person.death_year ?? person.birth_year)) / 2),
        )
      : null;

  return { person, memberships, meanwhile };
}

export interface ThemeDetail {
  theme: { id: string; name: string; description: string | null; calendar_mode: string };
  periods: PeriodRow[];
  people: PersonRow[];
  events: EventRow[];
}

export async function getThemeDetail(id: string): Promise<ThemeDetail | null> {
  const themes = await client<ThemeDetail["theme"][]>`
    SELECT id, name, description, calendar_mode FROM themes WHERE id = ${id}`;
  const theme = themes[0];
  if (!theme) return null;

  const [periods, people, events] = await Promise.all([
    client<PeriodRow[]>`
      SELECT p.* FROM periods p
      JOIN theme_memberships tm ON tm.entity_id = p.id AND tm.entity_type = 'period'
      WHERE tm.theme_id = ${id} ORDER BY p.start_year ASC`,
    client<PersonRow[]>`
      SELECT p.* FROM people p
      JOIN theme_memberships tm ON tm.entity_id = p.id AND tm.entity_type = 'person'
      WHERE tm.theme_id = ${id} ORDER BY p.birth_year ASC NULLS LAST`,
    client<EventRow[]>`
      SELECT e.* FROM events e
      JOIN theme_memberships tm ON tm.entity_id = e.id AND tm.entity_type = 'event'
      WHERE tm.theme_id = ${id} ORDER BY e.start_year ASC`,
  ]);

  return { theme, periods, people, events };
}

export async function getAllThemes() {
  return client<ThemeDetail["theme"][]>`
    SELECT id, name, description, calendar_mode FROM themes ORDER BY name`;
}

export async function getAllEvents(): Promise<EventRow[]> {
  return client<EventRow[]>`
    SELECT id, name, start_year, end_year, certainty, region, importance, summary
    FROM events ORDER BY start_year ASC`;
}

/** Entity ids belonging to a theme — the lens subgraph, one query. */
export async function getThemeEntityIds(
  themeId: string,
): Promise<{ periodIds: string[]; eventIds: string[] } | null> {
  const themeExists = await client`SELECT 1 FROM themes WHERE id = ${themeId}`;
  if (themeExists.length === 0) return null;
  const rows = await client<Array<{ entity_type: string; entity_id: string }>>`
    SELECT entity_type, entity_id FROM theme_memberships WHERE theme_id = ${themeId}`;
  return {
    periodIds: rows.filter((r) => r.entity_type === "period").map((r) => r.entity_id),
    eventIds: rows.filter((r) => r.entity_type === "event").map((r) => r.entity_id),
  };
}

/** People for the timeline: region borrowed from their earliest period. */
export async function getTimelinePeople() {
  return client<
    Array<{
      id: string;
      name: string;
      birth_year: number;
      death_year: number | null;
      importance: number;
      region: Region;
    }>
  >`
    SELECT DISTINCT ON (p.id)
      p.id, p.name, p.birth_year, p.death_year, p.importance, per.region
    FROM people p
    JOIN period_people pp ON pp.person_id = p.id
    JOIN periods per ON per.id = pp.period_id
    WHERE p.birth_year IS NOT NULL
    ORDER BY p.id, per.start_year ASC`;
}

/** Flat entity index for the header search box. */
export async function getSearchIndex() {
  const [periods, people, events, themes] = await Promise.all([
    client<Array<{ id: string; name: string; kind: string }>>`
      SELECT id, name, kind FROM periods ORDER BY name`,
    client<Array<{ id: string; name: string }>>`
      SELECT id, name FROM people ORDER BY name`,
    client<Array<{ id: string; name: string; start_year: number }>>`
      SELECT id, name, start_year FROM events ORDER BY name`,
    client<Array<{ id: string; name: string }>>`
      SELECT id, name FROM themes ORDER BY name`,
  ]);
  return [
    ...periods.map((p) => ({ id: p.id, name: p.name, type: "period" as const, detail: p.kind })),
    ...people.map((p) => ({ id: p.id, name: p.name, type: "person" as const, detail: "" })),
    ...events.map((e) => ({ id: e.id, name: e.name, type: "event" as const, detail: String(e.start_year) })),
    ...themes.map((t) => ({ id: t.id, name: t.name, type: "theme" as const, detail: "lens" })),
  ];
}
