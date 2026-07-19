/**
 * Spine content format. Each civilization gets one file exporting a
 * SpineModule; the seed script (scripts/seed.ts) upserts them all.
 *
 * Rules of the spine:
 *  - Years are astronomical integers. Use bce()/ce() from src/lib/dates.ts
 *    for anything pre-CE so intent stays readable in review.
 *  - Every entity SHOULD carry a wikidataQid — that's the enrichment hook.
 *  - `importance` 1–5 drives zoom LOD: 1 = visible at full zoom-out
 *    (empires, world wars), 5 = only at year-level zoom.
 *  - Keep summaries to 1–3 sentences. Long narrative belongs in MDX pages
 *    (Phase 1), not the graph.
 */

import type { Region } from "@/db/schema";

export type Certainty = "exact" | "circa" | "disputed" | "unknown";

export interface SpinePeriod {
  id: string;
  name: string;
  kind: "dynasty" | "empire" | "caliphate" | "kingdom" | "republic" | "era";
  startYear: number;
  endYear: number | null;
  startCertainty?: Certainty;
  endCertainty?: Certainty;
  region: Region;
  parentId?: string; // predecessor period (succession chain)
  importance: 1 | 2 | 3 | 4 | 5;
  summary: string;
  wikidataQid?: string;
  /** Heartland for the globe: capital/center + influence radius. */
  centerLat?: number;
  centerLng?: number;
  influenceKm?: number;
}

export interface SpinePerson {
  id: string;
  name: string;
  birthYear?: number;
  deathYear?: number;
  birthCertainty?: Certainty;
  deathCertainty?: Certainty;
  importance: 1 | 2 | 3 | 4 | 5;
  influence: string; // one line: why this person matters
  summary?: string;
  wikidataQid?: string;
  /** Place of principal activity — where this person shines on the globe's
   *  People view. One honest point (court, workshop, school), NOT a
   *  birthplace and NOT an itinerary; omit if no single place is honest. */
  lat?: number;
  lng?: number;
  place?: string;
  /** Memberships: which periods, in what role. Roles double as the People
   *  view's GENRE facet — keep the enum stable; new roles need a migration. */
  periods: Array<{
    periodId: string;
    role:
      | "ruler"
      | "scholar"
      | "general"
      | "artist"
      | "prophet"
      | "philosopher"
      | "explorer"
      | "founder";
  }>;
}

export interface SpineEvent {
  id: string;
  name: string;
  startYear: number;
  endYear?: number | null; // omit/null = point event
  certainty?: Certainty;
  region: Region;
  importance: 1 | 2 | 3 | 4 | 5;
  summary: string;
  wikidataQid?: string;
  /** Where it happened (globe pulse). */
  lat?: number;
  lng?: number;
  periodIds: string[]; // all periods this event touches
}

/**
 * One side of a link: EITHER an entity reference (resolved to the entity's
 * coordinates at render time — period heartland / person place / event
 * location) OR a literal place. The union makes the XOR rule structural in
 * the spine; the seed's lint pass re-checks it (and that entity refs
 * resolve) because the DB stores both shapes in nullable columns.
 */
export type SpineLinkEndpoint =
  | { type: "period" | "person" | "event"; id: string }
  | { lat: number; lng: number; label: string };

/**
 * A connection between two points of the graph, drawn as a great-circle arc
 * on the globe while alive. Entity endpoints are NOT database FKs — links may
 * reference entities from any module, in any seeding order; the seed lint
 * fails loudly on a dangling id instead.
 */
export interface SpineLink {
  id: string;
  kind: "embassy" | "war" | "trade" | "journey" | "transmission";
  a: SpineLinkEndpoint;
  b: SpineLinkEndpoint;
  startYear: number;
  endYear?: number | null; // omit/null = point link (short pulse window)
  certainty?: Certainty;
  importance?: 1 | 2 | 3 | 4 | 5; // defaults to 3
  summary: string;
  /** Journey hops share one groupId (the side panel collapses them). */
  groupId?: string;
  wikidataQid?: string;
}

export interface SpineModule {
  periods: SpinePeriod[];
  people: SpinePerson[];
  events: SpineEvent[];
  /** Connections contributed by this module (endpoints may cross modules). */
  links?: SpineLink[];
  /** theme id -> entity ids included in that lens */
  themeMemberships?: Record<
    string,
    { periods?: string[]; people?: string[]; events?: string[] }
  >;
}
