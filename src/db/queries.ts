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
  /** Heartland — present only on detail queries; gates the "world in <year>"
   *  deep link's &focus= (a focus without a heartland resolves to nothing). */
  center_lat?: number | null;
  center_lng?: number | null;
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
  /** Present only on detail queries; curated fields always win at render. */
  enrichment?: EnrichmentPayload | null;
  /** Location — present only on detail queries; gates the event page's
   *  "world in <year>" deep link's ?lat=&lng= centering hint. */
  lat?: number | null;
  lng?: number | null;
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
           region, parent_id, importance, summary, enrichment,
           center_lat, center_lng
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

export interface EventLinkRow {
  id: string;
  kind: "embassy" | "war" | "trade" | "journey" | "transmission";
  start_year: number;
  end_year: number | null;
  summary: string | null;
  /** The far side of the connection: an entity (pages can link to it) or a
   *  literal place (label only). */
  other:
    | { type: "period" | "person" | "event"; id: string; name: string }
    | { type: "place"; label: string | null };
}

export interface EventDetail {
  event: EventRow;
  /** Linked participants via event_periods. 0 is legal — the Hijra predates
   *  every period in the atlas; the page honors that, it doesn't hide it. */
  periods: PeriodRow[];
  /** Connections touching this event as an endpoint — empty for most events
   *  today; the page renders the section only when non-empty. */
  links: EventLinkRow[];
  /** The world at the event's moment: the shared point-sample slice, minus
   *  this event itself — getTimeSlice's ±25y events window would otherwise
   *  list the page's own subject (the same self-exclusion ConcurrentRail
   *  does for periods). */
  moment: TimeSlice;
}

export async function getEventDetail(id: string): Promise<EventDetail | null> {
  const rows = await client<EventRow[]>`
    SELECT id, name, start_year, end_year, certainty, region, importance,
           summary, enrichment, lat, lng
    FROM events WHERE id = ${id}`;
  const event = rows[0];
  if (!event) return null;

  const [periods, linkRows, slice] = await Promise.all([
    client<PeriodRow[]>`
      SELECT p.id, p.name, p.kind, p.start_year, p.end_year, p.start_certainty,
             p.end_certainty, p.region, p.parent_id, p.importance, p.summary
      FROM periods p
      JOIN event_periods ep ON ep.period_id = p.id
      WHERE ep.event_id = ${id}
      ORDER BY p.start_year ASC`,
    client<
      Array<{
        id: string;
        kind: EventLinkRow["kind"];
        a_type: "period" | "person" | "event" | null;
        a_id: string | null;
        a_label: string | null;
        b_type: "period" | "person" | "event" | null;
        b_id: string | null;
        b_label: string | null;
        start_year: number;
        end_year: number | null;
        summary: string | null;
      }>
    >`
      SELECT id, kind, a_type, a_id, a_label, b_type, b_id, b_label,
             start_year, end_year, summary
      FROM links
      WHERE (a_type = 'event' AND a_id = ${id})
         OR (b_type = 'event' AND b_id = ${id})
      ORDER BY importance ASC, start_year ASC`,
    getTimeSlice(event.start_year),
  ]);

  // Each link's OTHER endpoint (an event↔event link where this event is side
  // A keeps side B, and vice versa), resolved to a display name so the page
  // can link entity endpoints to their pages.
  const others = linkRows.map((l) =>
    l.a_type === "event" && l.a_id === id
      ? { type: l.b_type, id: l.b_id, label: l.b_label }
      : { type: l.a_type, id: l.a_id, label: l.a_label },
  );
  const namesFor = async (
    type: "period" | "person" | "event",
    table: "periods" | "people" | "events",
  ): Promise<Map<string, string>> => {
    const ids = [
      ...new Set(
        others.flatMap((o) => (o.type === type && o.id ? [o.id] : [])),
      ),
    ];
    if (ids.length === 0) return new Map();
    const named = await client<Array<{ id: string; name: string }>>`
      SELECT id, name FROM ${client(table)} WHERE id = ANY(${ids}::text[])`;
    return new Map(named.map((n) => [n.id, n.name]));
  };
  const names = {
    period: await namesFor("period", "periods"),
    person: await namesFor("person", "people"),
    event: await namesFor("event", "events"),
  };

  const links: EventLinkRow[] = linkRows.map((l, i) => {
    const o = others[i]!;
    return {
      id: l.id,
      kind: l.kind,
      start_year: l.start_year,
      end_year: l.end_year,
      summary: l.summary,
      other:
        o.type && o.id
          ? // Entity ids aren't FKs (see schema) — a dangling id falls back
            // to its slug rather than dropping the row.
            { type: o.type, id: o.id, name: names[o.type].get(o.id) ?? o.id }
          : { type: "place", label: o.label },
    };
  });

  return {
    event,
    periods,
    links,
    moment: { ...slice, events: slice.events.filter((e) => e.id !== id) },
  };
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
): Promise<{ periodIds: string[]; eventIds: string[]; personIds: string[] } | null> {
  const themeExists = await client`SELECT 1 FROM themes WHERE id = ${themeId}`;
  if (themeExists.length === 0) return null;
  const rows = await client<Array<{ entity_type: string; entity_id: string }>>`
    SELECT entity_type, entity_id FROM theme_memberships WHERE theme_id = ${themeId}`;
  return {
    periodIds: rows.filter((r) => r.entity_type === "period").map((r) => r.entity_id),
    eventIds: rows.filter((r) => r.entity_type === "event").map((r) => r.entity_id),
    personIds: rows.filter((r) => r.entity_type === "person").map((r) => r.entity_id),
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

/**
 * People for the globe's People view. One row per person with their
 * memberships AGGREGATED: `roles` and `period_ids` are the distinct sets the
 * genre/civilization facets match against, while `region` stays the earliest
 * period's (the same borrowing rule as getTimelinePeople). People without a
 * place still appear — they render in the side panel but never as a star.
 * People with no period membership are excluded by the join: they have no
 * lane region and no civilization to facet on (a documented honest gap).
 */
export async function getGlobePeople() {
  return client<
    Array<{
      id: string;
      name: string;
      birth_year: number;
      death_year: number | null;
      importance: number;
      lat: number | null;
      lng: number | null;
      place: string | null;
      region: Region;
      roles: string[];
      period_ids: string[];
    }>
  >`
    SELECT p.id, p.name, p.birth_year, p.death_year, p.importance,
           p.lat, p.lng, p.place,
           (SELECT per.region FROM periods per
              JOIN period_people pp2 ON pp2.period_id = per.id
              WHERE pp2.person_id = p.id
              ORDER BY per.start_year ASC LIMIT 1) AS region,
           array_agg(DISTINCT pp.role::text) AS roles,
           array_agg(DISTINCT pp.period_id) AS period_ids
    FROM people p
    JOIN period_people pp ON pp.person_id = p.id
    WHERE p.birth_year IS NOT NULL
    GROUP BY p.id
    ORDER BY p.importance ASC, p.birth_year ASC`;
}

/**
 * Connections for the globe — every link, typed as GlobeLink rows. The
 * caller resolves endpoints against the periods/people/events it already
 * loaded (resolveEndpoints in src/lib/globe.ts) and skips unresolvables.
 */
export async function getGlobeLinks() {
  return client<
    Array<{
      id: string;
      kind: "embassy" | "war" | "trade" | "journey" | "transmission";
      a_type: "period" | "person" | "event" | null;
      a_id: string | null;
      a_lat: number | null;
      a_lng: number | null;
      a_label: string | null;
      b_type: "period" | "person" | "event" | null;
      b_id: string | null;
      b_lat: number | null;
      b_lng: number | null;
      b_label: string | null;
      start_year: number;
      end_year: number | null;
      importance: number;
      summary: string | null;
      group_id: string | null;
    }>
  >`
    SELECT id, kind, a_type, a_id, a_lat, a_lng, a_label,
           b_type, b_id, b_lat, b_lng, b_label,
           start_year, end_year, importance, summary, group_id
    FROM links
    ORDER BY importance ASC, start_year ASC`;
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
