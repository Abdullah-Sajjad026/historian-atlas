/**
 * Modern-borders overlay — pure label selection, unit-testable, shared by the
 * globe client and the node-canvas preview script.
 *
 * The overlay answers "what modern country sits under this historical circle?"
 * so labels must cover (a) countries big enough to orient by and (b) a curated
 * allowlist of reference states regardless of size. Names match
 * world-atlas countries-110m `feature.properties.name` exactly.
 */

import { geoArea, geoCentroid, type ExtendedFeature } from "d3-geo";

export interface CountryFeature extends ExtendedFeature {
  properties: { name?: string } | null;
}

export interface CountryLabel {
  name: string;
  lat: number;
  lng: number;
}

/**
 * geoArea is in steradians (sphere = 4π ≈ 12.57). 0.025 sr ≈ 1M km² —
 * roughly Egypt/Bolivia and up qualify by size alone.
 */
export const COUNTRY_AREA_THRESHOLD = 0.025;

/** Always labeled, however small — the states readers orient by. */
export const COUNTRY_LABEL_ALLOWLIST: ReadonlySet<string> = new Set([
  "Pakistan",
  "India",
  "China",
  "United States of America",
  "Russia",
  "Brazil",
  "Indonesia",
  "Nigeria",
  "Egypt",
  "Turkey",
  "Iran",
  "Germany",
  "France",
  "United Kingdom",
  "Japan",
  "Mexico",
  "Saudi Arabia",
  "Spain",
  "Italy",
  "Vietnam",
  "Bangladesh",
  "Ethiopia",
  "South Africa",
  "Argentina",
  "Australia",
  "Kazakhstan",
  "Algeria",
  "Dem. Rep. Congo",
  "Canada",
  "Poland",
  "Iraq",
  "Afghanistan",
  "Ukraine",
  "Sudan",
  "Morocco",
  "Peru",
  "Colombia",
  "Thailand",
  "Myanmar",
  "South Korea",
  "Philippines",
  "Malaysia",
  "Uzbekistan",
]);

/**
 * Pick which countries get a label: everything above the area threshold plus
 * the allowlist. Position is the spherical centroid (good enough for a
 * receding annotation; no nudging).
 */
export function selectCountryLabels(
  features: readonly CountryFeature[],
  opts: { minArea?: number; allowlist?: ReadonlySet<string> } = {},
): CountryLabel[] {
  const minArea = opts.minArea ?? COUNTRY_AREA_THRESHOLD;
  const allowlist = opts.allowlist ?? COUNTRY_LABEL_ALLOWLIST;
  const out: CountryLabel[] = [];
  for (const f of features) {
    const name = f.properties?.name;
    if (!name) continue;
    if (!allowlist.has(name) && geoArea(f) < minArea) continue;
    const [lng, lat] = geoCentroid(f);
    out.push({ name, lat, lng });
  }
  return out;
}
