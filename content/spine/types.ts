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

export interface SpineModule {
  periods: SpinePeriod[];
  people: SpinePerson[];
  events: SpineEvent[];
  /** theme id -> entity ids included in that lens */
  themeMemberships?: Record<
    string,
    { periods?: string[]; people?: string[]; events?: string[] }
  >;
}
