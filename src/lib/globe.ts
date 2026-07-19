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
export function pulseIntensity(
  eventYear: number,
  year: number,
  window: number = PULSE_WINDOW,
): number {
  const d = Math.abs(eventYear - year);
  return d > window ? 0 : 1 - d / window;
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
 * The pole bound for the orthographic φ rotation: the drag clamps to ±80° so
 * the globe can't flip over a pole, and rotations computed from coordinates
 * honor the same bound.
 */
export const MAX_PHI = 80;

/**
 * The orthographic rotation that centers a point. d3 rotates the SPHERE, so
 * centering [lng, lat] means negating both; latitude is clamped to MAX_PHI so
 * a ?focus= entry can never produce a rotation the drag couldn't reach.
 */
export function rotationForPoint(lat: number, lng: number): [number, number] {
  return [-lng, -Math.max(-MAX_PHI, Math.min(MAX_PHI, lat))];
}

/**
 * Parse-and-clamp for the ?year= URL param. Absent, empty, or non-numeric
 * input returns null (callers fall back to their default year); numeric input
 * is rounded to an integer and clamped into [min, max].
 */
export function clampYear(
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Parse-and-clamp for the ?lat=/?lng= URL params — the event-page entry hint
 * (events have coordinates, not a ?focus= slug). Same null contract as
 * clampYear, but coordinates keep their fraction and clamp into ±bound
 * (90 for latitude, 180 for longitude).
 */
export function clampCoord(
  raw: string | undefined,
  bound: number,
): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(-bound, Math.min(bound, n));
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

// ---------------------------------------------------------------------------
// Connections — links between entities, drawn as great-circle arcs
// ---------------------------------------------------------------------------

export type LinkKind =
  | "embassy"
  | "war"
  | "trade"
  | "journey"
  | "transmission";
export type LinkEndpointType = "period" | "person" | "event";

/** A links row as read from the DB. Each endpoint is EITHER an entity ref
 *  (type + id) or a literal place (lat + lng + label) — the seed lint
 *  enforces the XOR, so exactly one shape is populated per side. */
export interface GlobeLink {
  id: string;
  kind: LinkKind;
  a_type: LinkEndpointType | null;
  a_id: string | null;
  a_lat: number | null;
  a_lng: number | null;
  a_label: string | null;
  b_type: LinkEndpointType | null;
  b_id: string | null;
  b_lat: number | null;
  b_lng: number | null;
  b_label: string | null;
  start_year: number;
  end_year: number | null; // null = point link (short pulse window)
  importance: number;
  summary: string | null;
  group_id: string | null;
}

export interface ResolvedEndpoint {
  lat: number;
  lng: number;
  label: string;
  /** Both null for literal endpoints — kept so the lens multiplier and the
   *  panel know which endpoints are entities. */
  entityType: LinkEndpointType | null;
  entityId: string | null;
}

/** A link whose endpoints resolved to coordinates — what the draw consumes. */
export interface ResolvedLink {
  link: GlobeLink;
  a: ResolvedEndpoint;
  b: ResolvedEndpoint;
}

/**
 * Resolve a link's endpoints to coordinates: period refs use the heartland,
 * person refs the place of principal activity, event refs the event location;
 * literal endpoints pass through. Resolution ignores endpoint LIFETIMES on
 * purpose — a transmission can outlive its transmitters (Indian numerals
 * reach Baghdad two centuries after the Gupta), so heartlands resolve
 * regardless of whether the endpoint entity is alive at the link's years.
 *
 * Returns null if EITHER side can't resolve (unknown id, entity without
 * coordinates) — callers skip such links; the seed lint already warned.
 */
export function resolveEndpoints(
  link: GlobeLink,
  data: { periods: GlobePeriod[]; people: GlobePerson[]; events: GlobeEvent[] },
): [ResolvedEndpoint, ResolvedEndpoint] | null {
  const one = (
    type: LinkEndpointType | null,
    id: string | null,
    lat: number | null,
    lng: number | null,
    label: string | null,
  ): ResolvedEndpoint | null => {
    if (type === null) {
      if (lat === null || lng === null) return null;
      return { lat, lng, label: label ?? "", entityType: null, entityId: null };
    }
    if (id === null) return null;
    let pt: { lat: number | null; lng: number | null; name: string } | undefined;
    if (type === "period") {
      const p = data.periods.find((p) => p.id === id);
      if (p) pt = { lat: p.center_lat, lng: p.center_lng, name: p.name };
    } else if (type === "person") {
      const p = data.people.find((p) => p.id === id);
      if (p) pt = { lat: p.lat, lng: p.lng, name: p.name };
    } else {
      const e = data.events.find((e) => e.id === id);
      if (e) pt = { lat: e.lat, lng: e.lng, name: e.name };
    }
    if (!pt || pt.lat === null || pt.lng === null) return null;
    return { lat: pt.lat, lng: pt.lng, label: pt.name, entityType: type, entityId: id };
  };

  const a = one(link.a_type, link.a_id, link.a_lat, link.a_lng, link.a_label);
  const b = one(link.b_type, link.b_id, link.b_lat, link.b_lng, link.b_label);
  return a && b ? [a, b] : null;
}

/**
 * Link temporal alpha. Point links (end_year null) flare like events but in
 * a tighter window — pulseIntensity with an ±8y window, peak 1 at the year.
 * Range links breathe like empires — the SAME lifeFade ramp mapped over
 * {start_year, end_year}, not a fork of it.
 */
export const LINK_PULSE_WINDOW = 8;
export function linkAlpha(
  link: Pick<GlobeLink, "start_year" | "end_year">,
  year: number,
): number {
  if (link.end_year === null) {
    return pulseIntensity(link.start_year, year, LINK_PULSE_WINDOW);
  }
  return lifeFade({ start_year: link.start_year, end_year: link.end_year }, year);
}

export interface LinkLensSets {
  periodIds?: Set<string>;
  personIds?: Set<string>;
  eventIds?: Set<string>;
}

/**
 * Lens interaction for links, with no schema change: the arc's multiplier is
 * the MAX of lensAlpha over its ENTITY endpoints — a link touching any lens
 * member stays lit. Literal endpoints contribute GHOST_ALPHA (a place is
 * never a lens member), so a lens-outsider ↔ literal link ghosts as a whole.
 * No active lens (undefined) = 1, like lensAlpha.
 */
export function linkLensAlpha(
  link: Pick<GlobeLink, "a_type" | "a_id" | "b_type" | "b_id">,
  lens?: LinkLensSets,
): number {
  if (!lens) return 1;
  const one = (type: LinkEndpointType | null, id: string | null): number => {
    if (type === null || id === null) return GHOST_ALPHA; // literal endpoint
    const set =
      type === "period"
        ? lens.periodIds
        : type === "person"
          ? lens.personIds
          : lens.eventIds;
    // Lens active but no members of this type = an empty set, not "no lens".
    return lensAlpha(id, set ?? new Set());
  };
  return Math.max(one(link.a_type, link.a_id), one(link.b_type, link.b_id));
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
