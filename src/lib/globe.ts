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
