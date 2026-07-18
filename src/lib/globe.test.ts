import { describe, it, expect } from "vitest";
import {
  lensAlpha,
  GHOST_ALPHA,
  lifeFade,
  activeAt,
  mappablePeriods,
  kmToDegrees,
  pulseIntensity,
  visibleEvents,
  type GlobePeriod,
} from "./globe";

function gp(over: Partial<GlobePeriod> & Pick<GlobePeriod, "id" | "start_year">): GlobePeriod {
  return {
    name: over.id!,
    region: "mena",
    end_year: null,
    center_lat: 33,
    center_lng: 44,
    influence_km: 1000,
    importance: 1,
    ...over,
  } as GlobePeriod;
}

describe("activeAt", () => {
  it("is inclusive on both endpoints", () => {
    const p = gp({ id: "x", start_year: 750, end_year: 1258 });
    expect(activeAt(p, 750)).toBe(true);
    expect(activeAt(p, 1258)).toBe(true);
    expect(activeAt(p, 749)).toBe(false);
    expect(activeAt(p, 1259)).toBe(false);
  });
  it("treats null end as ongoing", () => {
    expect(activeAt(gp({ id: "x", start_year: 1900, end_year: null }), 2500)).toBe(true);
  });
});

describe("mappablePeriods", () => {
  it("drops periods without heartlands and sorts large influence first", () => {
    const out = mappablePeriods(
      [
        gp({ id: "small", start_year: 700, influence_km: 500 }),
        gp({ id: "nogeo", start_year: 700, center_lat: null }),
        gp({ id: "big", start_year: 700, influence_km: 3000 }),
        gp({ id: "dead", start_year: 100, end_year: 200 }),
      ],
      750,
    );
    expect(out.map((p) => p.id)).toEqual(["big", "small"]);
  });
});

describe("kmToDegrees", () => {
  it("converts one degree of arc (~111.32 km)", () => {
    expect(kmToDegrees(111.32)).toBeCloseTo(1, 5);
  });
});

describe("pulses", () => {
  it("peaks at the event year and fades linearly to the window edge", () => {
    expect(pulseIntensity(751, 751)).toBe(1);
    expect(pulseIntensity(751, 758.5)).toBeCloseTo(0.5);
    expect(pulseIntensity(751, 767)).toBe(0);
  });
  it("visibleEvents filters geo-less and out-of-window events", () => {
    const out = visibleEvents(
      [
        { id: "talas", name: "", start_year: 751, region: "east-asia", lat: 42.5, lng: 72.2, importance: 2 },
        { id: "nogeo", name: "", start_year: 751, region: "mena", lat: null, lng: null, importance: 1 },
        { id: "far", name: "", start_year: 900, region: "mena", lat: 10, lng: 10, importance: 1 },
      ],
      755,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("talas");
    expect(out[0]!.intensity).toBeCloseTo(1 - 4 / 15);
  });
});

describe("lifeFade", () => {
  const p = { start_year: 750, end_year: 1258 };
  it("ramps in over the first decade and out over the last", () => {
    expect(lifeFade(p, 755)).toBeCloseTo(0.5);
    expect(lifeFade(p, 760)).toBe(1);
    expect(lifeFade(p, 1000)).toBe(1);
    expect(lifeFade(p, 1253)).toBeCloseTo(0.5);
  });
  it("floors at a visible minimum inside the lifetime, zero outside", () => {
    expect(lifeFade(p, 750)).toBeCloseTo(0.08);
    expect(lifeFade(p, 749)).toBe(0);
    expect(lifeFade({ start_year: 1900, end_year: null }, 3000)).toBe(1);
  });
});

describe("lensAlpha", () => {
  it("is full strength with no lens active", () => {
    expect(lensAlpha("anything")).toBe(1);
  });
  it("spotlights members and ghosts everything else", () => {
    const lens = new Set(["abbasid-caliphate"]);
    expect(lensAlpha("abbasid-caliphate", lens)).toBe(1);
    expect(lensAlpha("tang-dynasty", lens)).toBe(GHOST_ALPHA);
  });
});
