/**
 * Globe view helpers — pure functions, unit-testable, shared between the
 * client renderer and the node-canvas preview script.
 */

import { ONGOING } from "@/lib/dates";

export interface GlobePeriod {
  id: string;
  name: string;
  region: string;
  start_year: number;
  end_year: number | null;
  center_lat: number | null;
  center_lng: number | null;
  influence_km: number | null;
  importance: number;
}

export interface GlobeEvent {
  id: string;
  name: string;
  start_year: number;
  region: string;
  lat: number | null;
  lng: number | null;
  importance: number;
}

/** Is this period alive in year T? (inclusive, ongoing = open end) */
export function activeAt(
  p: Pick<GlobePeriod, "start_year" | "end_year">,
  year: number,
): boolean {
  return p.start_year <= year && year <= (p.end_year ?? ONGOING);
}

/** Mappable = alive AND has a heartland. */
export function mappablePeriods(ps: GlobePeriod[], year: number): GlobePeriod[] {
  return ps
    .filter((p) => activeAt(p, year) && p.center_lat !== null && p.center_lng !== null)
    .sort((a, b) => (b.influence_km ?? 0) - (a.influence_km ?? 0)); // big circles paint first
}

/** Sphere-of-influence radius in degrees of arc for d3.geoCircle. */
export function kmToDegrees(km: number): number {
  return km / 111.32;
}

/**
 * Event pulse: events flare on the globe for a window around their year.
 * Returns 0..1 intensity (1 = the exact year), linear falloff over ±15y.
 */
export const PULSE_WINDOW = 15;
export function pulseIntensity(eventYear: number, year: number): number {
  const d = Math.abs(eventYear - year);
  return d > PULSE_WINDOW ? 0 : 1 - d / PULSE_WINDOW;
}

export function visibleEvents(
  events: GlobeEvent[],
  year: number,
): Array<GlobeEvent & { intensity: number }> {
  return events
    .filter((e) => e.lat !== null && e.lng !== null)
    .map((e) => ({ ...e, intensity: pulseIntensity(e.start_year, year) }))
    .filter((e) => e.intensity > 0);
}

/**
 * Birth/death fade: 0..1 alpha multiplier so influence circles swell in over
 * a period's first FADE_YEARS and dissolve over its last, instead of popping.
 * Returns 0 outside the period's lifetime.
 */
export const FADE_YEARS = 10;
export function lifeFade(
  p: Pick<GlobePeriod, "start_year" | "end_year">,
  year: number,
): number {
  if (!activeAt(p, year)) return 0;
  const sinceBirth = (year - p.start_year) / FADE_YEARS;
  const untilDeath =
    p.end_year === null ? 1 : (p.end_year - year) / FADE_YEARS;
  return Math.max(0.08, Math.min(1, sinceBirth, untilDeath));
}

/**
 * Lens ghosting: entities outside an active lens render dimmed, not hidden —
 * the lens is a spotlight on the world, not a filter that deletes it.
 * No lens (undefined) = everything at full strength.
 */
export const GHOST_ALPHA = 0.15;
export function lensAlpha(id: string, lensIds?: Set<string>): number {
  if (!lensIds) return 1;
  return lensIds.has(id) ? 1 : GHOST_ALPHA;
}

// ---------------------------------------------------------------------------
// People view — stars on the globe
// ---------------------------------------------------------------------------

export interface GlobePerson {
  id: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  /** Borrowed from the earliest period membership (same rule as the timeline). */
  region: string;
  /** Place of principal activity. Null = renders in the side panel only. */
  lat: number | null;
  lng: number | null;
  place: string | null;
  importance: number;
  /** ALL membership roles, distinct — the genre facet matches against these. */
  roles: string[];
  /** ALL membership period ids, distinct — the civilization facet matches these. */
  period_ids: string[];
}

/** Open death = nominal lifespan, same convention as the timeline's geometry. */
export const NOMINAL_LIFESPAN = 70;

export function personAliveAt(
  p: Pick<GlobePerson, "birth_year" | "death_year">,
  year: number,
): boolean {
  return (
    p.birth_year <= year &&
    year <= (p.death_year ?? p.birth_year + NOMINAL_LIFESPAN)
  );
}

/**
 * Faceted narrowing of the people set. Facets FILTER — they narrow which
 * people exist in the view — unlike the lens, which only DIMS (a spotlight
 * on the world). That asymmetry is deliberate; keep the two systems apart.
 *
 * - genres: match if ANY of the person's roles is in the set
 * - periodIds: match if ANY membership is in the set
 * - both present = AND; empty/undefined facet = no constraint
 */
export interface PeopleFacets {
  genres?: string[];
  periodIds?: string[];
}

export function filterPeople(
  people: GlobePerson[],
  facets: PeopleFacets,
): GlobePerson[] {
  const genres = facets.genres?.length ? new Set(facets.genres) : null;
  const civs = facets.periodIds?.length ? new Set(facets.periodIds) : null;
  return people.filter(
    (p) =>
      (!genres || p.roles.some((r) => genres.has(r))) &&
      (!civs || p.period_ids.some((id) => civs.has(id))),
  );
}

/**
 * People sharing an exact place (three Byzantines at Constantinople) would
 * stack into one star — fan coincident points into a small ring instead.
 * Longitude offsets are widened by 1/cos(lat) so the ring stays visually
 * round away from the equator. Pure so it's testable; applied per-frame to
 * the ALIVE set only (the dead don't reserve seats in the ring).
 */
export const SPREAD_DEGREES = 1.4;
export function fanOutCoincident<T extends { lat: number; lng: number }>(
  people: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const p of people) {
    const key = `${p.lat},${p.lng}`;
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  const out: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    group.forEach((p, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / group.length;
      out.push({
        ...p,
        lat: p.lat + SPREAD_DEGREES * Math.sin(angle),
        lng:
          p.lng +
          (SPREAD_DEGREES * Math.cos(angle)) /
            Math.cos((p.lat * Math.PI) / 180),
      });
    });
  }
  return out;
}

/**
 * Star lifecycle fade — people kindle and dim exactly the way empires
 * breathe: the SAME lifeFade ramp, mapped over the lifespan. An open death
 * gets no dim-out ramp (null end = lifeFade's ongoing case); the star still
 * disappears at the nominal-lifespan bound because starPeople drops it.
 */
export function personFade(
  p: Pick<GlobePerson, "birth_year" | "death_year">,
  year: number,
): number {
  return lifeFade({ start_year: p.birth_year, end_year: p.death_year }, year);
}

/**
 * The stars for one frame: alive in T, mappable (has a place), coincident
 * points fanned out, minor people first so important stars paint on top.
 */
export function starPeople(
  people: GlobePerson[],
  year: number,
): Array<GlobePerson & { lat: number; lng: number }> {
  const alive = people.filter(
    (p): p is GlobePerson & { lat: number; lng: number } =>
      p.lat !== null && p.lng !== null && personAliveAt(p, year),
  );
  return fanOutCoincident(alive).sort((a, b) => b.importance - a.importance);
}
