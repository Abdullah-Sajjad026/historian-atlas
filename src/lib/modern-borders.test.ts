import { describe, it, expect } from "vitest";
import { geoArea } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countriesData from "world-atlas/countries-110m.json";
import {
  selectCountryLabels,
  COUNTRY_AREA_THRESHOLD,
  COUNTRY_LABEL_ALLOWLIST,
  type CountryFeature,
} from "./modern-borders";

// Real bundled data — the same conversion the client and preview script do.
const topo = countriesData as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(topo, topo.objects.countries).features as CountryFeature[];

const names = (labels: ReturnType<typeof selectCountryLabels>) =>
  labels.map((l) => l.name);

describe("selectCountryLabels", () => {
  it("includes big countries by area even with an empty allowlist", () => {
    const out = names(selectCountryLabels(features, { allowlist: new Set() }));
    expect(out).toContain("Russia");
    expect(out).toContain("Brazil");
    expect(out).toContain("Kazakhstan");
  });

  it("threshold-filters small countries not on the allowlist", () => {
    const out = names(selectCountryLabels(features));
    expect(out).not.toContain("Luxembourg");
    expect(out).not.toContain("Fiji");
  });

  it("always selects Pakistan — it is below the area threshold", () => {
    // Guard: if the threshold ever drops below Pakistan's area, the allowlist
    // assertion becomes vacuous — this keeps the test honest.
    const pakistan = features.find((f) => f.properties?.name === "Pakistan")!;
    const byAreaOnly = names(
      selectCountryLabels([pakistan], { allowlist: new Set() }),
    );
    expect(byAreaOnly).not.toContain("Pakistan");

    expect(names(selectCountryLabels(features))).toContain("Pakistan");
    // ...even with an absurd threshold: the allowlist is unconditional.
    expect(names(selectCountryLabels(features, { minArea: Infinity }))).toContain(
      "Pakistan",
    );
  });

  it("selects every allowlisted name (no drift vs the dataset's spellings)", () => {
    const out = new Set(names(selectCountryLabels(features)));
    for (const name of COUNTRY_LABEL_ALLOWLIST) {
      expect(out).toContain(name);
    }
  });

  it("places Pakistan's centroid inside Pakistan's bounding box", () => {
    const label = selectCountryLabels(features).find((l) => l.name === "Pakistan")!;
    expect(label.lat).toBeGreaterThan(23);
    expect(label.lat).toBeLessThan(38);
    expect(label.lng).toBeGreaterThan(60);
    expect(label.lng).toBeLessThan(78);
  });

  it("skips features without a name", () => {
    const anon = { ...features[0]!, properties: null } as CountryFeature;
    expect(selectCountryLabels([anon], { minArea: 0 })).toEqual([]);
  });

  it("exposes a threshold in steradians (sanity: below Russia, above Fiji)", () => {
    const russia = features.find((f) => f.properties?.name === "Russia")!;
    const fiji = features.find((f) => f.properties?.name === "Fiji")!;
    expect(geoArea(russia)).toBeGreaterThan(COUNTRY_AREA_THRESHOLD);
    expect(geoArea(fiji)).toBeLessThan(COUNTRY_AREA_THRESHOLD);
  });
});
