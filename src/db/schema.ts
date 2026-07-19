/**
 * Database schema — the historical knowledge graph.
 *
 * Design invariants:
 *  1. All years are ASTRONOMICAL integers (see src/lib/dates.ts). Never store
 *     calendar-specific values.
 *  2. `yearRange` is a GENERATED int4range column; the GiST index on it makes
 *     the time-slice query ("world in year T") an index scan:
 *       SELECT * FROM periods WHERE year_range @> 750;
 *  3. Curated fields always win over `enrichment` (Wikidata JSONB) at render
 *     time. Enrichment is quarantined in one column so bad data is one
 *     UPDATE away from gone.
 *  4. Themes are lenses (join tables), not categories on the entities.
 *
 * Note: Drizzle has no native int4range/GENERATED support, so those are
 * declared via customType + raw SQL in the companion migration
 * (drizzle/0001_ranges.sql). Schema here stays the single source of truth
 * for everything Drizzle *can* express.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  smallint,
  real,
  jsonb,
  timestamp,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export const dateCertainty = pgEnum("date_certainty", [
  "exact",
  "circa",
  "disputed",
  "unknown",
]);

export const periodKind = pgEnum("period_kind", [
  "dynasty",
  "empire",
  "caliphate",
  "kingdom",
  "republic",
  "era",
]);

/** int4range is not covered by drizzle-orm; read side only — writes are generated. */
const int4range = customType<{ data: string }>({
  dataType: () => "int4range",
});

/**
 * Swim-lane taxonomy for the parallel timeline. Deliberately capped at 7 —
 * more lanes and the timeline turns to soup. Finer geography belongs on
 * entities' own metadata, not in the lane key.
 */
export const REGIONS = [
  "east-asia",
  "south-asia",
  "mena", // Middle East & North Africa
  "europe",
  "sub-saharan-africa",
  "americas",
  "steppe-central-asia",
] as const;
export type Region = (typeof REGIONS)[number];

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export const periods = pgTable(
  "periods",
  {
    id: text("id").primaryKey(), // slug: 'abbasid-caliphate'
    name: text("name").notNull(),
    kind: periodKind("kind").notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"), // NULL = ongoing / no clean end
    startCertainty: dateCertainty("start_certainty").notNull().default("exact"),
    endCertainty: dateCertainty("end_certainty").notNull().default("exact"),
    // GENERATED ALWAYS AS (int4range(start_year, COALESCE(end_year, 3000), '[]'))
    // — declared in raw migration; typed here for reads.
    yearRange: int4range("year_range"),
    region: text("region").$type<Region>().notNull(),
    parentId: text("parent_id"), // succession: rashidun -> umayyad -> abbasid
    importance: smallint("importance").notNull().default(3), // 1 (major) .. 5 (minor); drives zoom LOD
    summary: text("summary"),
    /** Heartland: capital/center point + sphere-of-influence radius for the
     *  globe view. Deliberately NOT precise borders — per-year historical
     *  boundary data is a licensing problem (GeaCron-scale); circles of
     *  influence are honest and readable. Nullable: not every era maps. */
    centerLat: real("center_lat"),
    centerLng: real("center_lng"),
    influenceKm: integer("influence_km"),
    wikidataQid: text("wikidata_qid"),
    enrichment: jsonb("enrichment"), // quarantined Wikidata payload
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  },
  (t) => [
    index("periods_region_idx").on(t.region),
    index("periods_importance_idx").on(t.importance),
    // GiST index on year_range lives in drizzle/0001_ranges.sql
  ],
);

export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey(), // slug: 'harun-al-rashid'
    name: text("name").notNull(),
    birthYear: integer("birth_year"),
    deathYear: integer("death_year"),
    birthCertainty: dateCertainty("birth_certainty").notNull().default("exact"),
    deathCertainty: dateCertainty("death_certainty").notNull().default("exact"),
    lifeRange: int4range("life_range"), // GENERATED — see raw migration
    importance: smallint("importance").notNull().default(3),
    /** One-line "why this person matters" — the influence summary. */
    influence: text("influence"),
    summary: text("summary"),
    /** Place of principal activity — where this person shines on the globe
     *  (People view). One honest point (court, workshop, school), not a
     *  birthplace and not an itinerary. Nullable: not everyone maps. */
    lat: real("lat"),
    lng: real("lng"),
    place: text("place"),
    wikidataQid: text("wikidata_qid"),
    enrichment: jsonb("enrichment"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  },
  (t) => [index("people_importance_idx").on(t.importance)],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(), // slug: 'siege-of-baghdad-1258'
    name: text("name").notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"), // NULL = point event
    certainty: dateCertainty("certainty").notNull().default("exact"),
    yearRange: int4range("year_range"), // GENERATED — point events collapse to [y,y]
    region: text("region").$type<Region>().notNull(),
    importance: smallint("importance").notNull().default(3),
    summary: text("summary"),
    /** Where it happened — event pulse location on the globe. Nullable. */
    lat: real("lat"),
    lng: real("lng"),
    wikidataQid: text("wikidata_qid"),
    enrichment: jsonb("enrichment"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  },
  (t) => [index("events_region_idx").on(t.region)],
);

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export const personRole = pgEnum("person_role", [
  "ruler",
  "scholar",
  "general",
  "artist",
  "prophet",
  "philosopher",
  "explorer",
  "founder",
]);

/** Person <-> Period membership with a role ("Harun al-Rashid, ruler, Abbasids"). */
export const periodPeople = pgTable(
  "period_people",
  {
    periodId: text("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: personRole("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.periodId, t.personId, t.role] })],
);

/** Event <-> Period links (many-to-many: the Siege of Baghdad touches Abbasids AND the Mongol Empire). */
export const eventPeriods = pgTable(
  "event_periods",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    periodId: text("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.periodId] })],
);

// ---------------------------------------------------------------------------
// Links — connections between entities, drawn as great-circle arcs on the globe
// ---------------------------------------------------------------------------

export const linkKind = pgEnum("link_kind", [
  "embassy",
  "war",
  "trade",
  "journey",
  "transmission",
]);

export const linkEndpointType = pgEnum("link_endpoint_type", [
  "period",
  "person",
  "event",
]);

/**
 * A relationship between two points in the graph — an embassy, a war, a trade
 * route, a journey leg, a transmission of ideas — rendered as a great-circle
 * arc between its endpoints while alive.
 *
 * Each endpoint is EITHER an entity reference (type + id, resolved to the
 * entity's coordinates at render time: period heartland / person place /
 * event location) OR a literal place (lat + lng + label). That XOR rule is
 * enforced by the seed's lint pass and the spine types, not the DB — entity
 * ids deliberately aren't FKs so links can cross content modules in any
 * seeding order.
 */
export const links = pgTable("links", {
  id: text("id").primaryKey(), // slug: 'embassy-harun-charlemagne'
  kind: linkKind("kind").notNull(),
  aType: linkEndpointType("a_type"),
  aId: text("a_id"),
  aLat: real("a_lat"),
  aLng: real("a_lng"),
  aLabel: text("a_label"),
  bType: linkEndpointType("b_type"),
  bId: text("b_id"),
  bLat: real("b_lat"),
  bLng: real("b_lng"),
  bLabel: text("b_label"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"), // NULL = point link (single-year pulse window)
  certainty: dateCertainty("certainty").notNull().default("exact"),
  importance: smallint("importance").notNull().default(3),
  summary: text("summary"),
  /** Journey hops share one group_id (Ibn Battuta's three legs = one journey). */
  groupId: text("group_id"),
  wikidataQid: text("wikidata_qid"),
});

// ---------------------------------------------------------------------------
// Themes — lenses over the graph
// ---------------------------------------------------------------------------

export const themes = pgTable("themes", {
  id: text("id").primaryKey(), // 'islamic-history'
  name: text("name").notNull(),
  description: text("description"),
  /** Display calendar hint for the lens: 'gregorian' | 'dual-hijri'. */
  calendarMode: text("calendar_mode").notNull().default("gregorian"),
});

export const themeEntityType = pgEnum("theme_entity_type", [
  "period",
  "person",
  "event",
]);

export const themeMemberships = pgTable(
  "theme_memberships",
  {
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    entityType: themeEntityType("entity_type").notNull(),
    entityId: text("entity_id").notNull(), // polymorphic by design; FK enforced in app layer
  },
  (t) => [
    primaryKey({ columns: [t.themeId, t.entityType, t.entityId] }),
    index("theme_memberships_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Convenience: raw time-slice query used by the "world in year T" view. */
export const timeSliceSql = (year: number) =>
  sql`SELECT * FROM periods WHERE year_range @> ${year}::int ORDER BY importance ASC, start_year ASC`;
