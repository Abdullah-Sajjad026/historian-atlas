/**
 * Globe paint — ONE draw function shared verbatim by the browser client and
 * the node-canvas preview script (their 2D contexts are API-compatible), so
 * the preview is a true visual regression of the shipped renderer.
 *
 * Look: an antique celestial globe. Vellum sphere with a soft light from the
 * upper left, ink coastlines on parchment land, hairline graticule, and each
 * living civilization as a translucent pigment sphere of influence around a
 * marked heartland. Events flare as expanding rings around their year.
 */

import {
  geoOrthographic,
  geoPath,
  geoCircle,
  geoGraticule10,
  type GeoPermissibleObjects,
} from "d3-geo";
import {
  mappablePeriods,
  visibleEvents,
  kmToDegrees,
  lifeFade,
  lensAlpha,
  type GlobePeriod,
  type GlobeEvent,
} from "./globe";
import type { CountryLabel } from "./modern-borders";

export interface GlobePalette {
  vellum: string;
  vellumDeep: string;
  ink: string;
  soft: string;
  rule: string;
  land: string;
  pigment: (region: string) => string;
}

export interface GlobeFrame {
  width: number;
  height: number;
  rotation: [number, number]; // [lambda, phi]
  zoom: number; // 1 = sphere fits with margin
  year: number;
  periods: GlobePeriod[];
  events: GlobeEvent[];
  land: GeoPermissibleObjects; // GeoJSON land geometry
  /** Active lens: members render full-strength, everything else ghosts.
   *  Separate sets because period and event ids share no namespace guarantee. */
  lensPeriodIds?: Set<string>;
  lensEventIds?: Set<string>;
  /** Modern-borders overlay — a constant chart annotation. Deliberately
   *  outside the lens/lifeFade systems: it is the same in every year and
   *  never ghosts (it is the reference grid the lens is read against). */
  modern?: ModernOverlay;
}

export interface ModernOverlay {
  /** Toggle here (not by omitting the object) so callers keep the geometry
   *  loaded across repaints while the checkbox is off. */
  enabled: boolean;
  /** Border geometry to stroke — topojson mesh of INTERIOR country borders
   *  (filter a !== b), so shared borders stroke once and coastlines are not
   *  re-traced in dashes over the solid ink shoreline. */
  borders: GeoPermissibleObjects;
  /** Pre-selected by selectCountryLabels (pure, tested, computed once). */
  labels: CountryLabel[];
}

/** Hex -> rgba with alpha (canvas has no color-mix). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export interface DrawResult {
  /** Screen positions of drawn heartlands, for hit-testing/labels upstream. */
  heartlands: Array<{ id: string; name: string; x: number; y: number; region: string }>;
}

// Structural type so both DOM and node-canvas contexts satisfy it.
type Ctx = CanvasRenderingContext2D;

export function drawGlobe(ctx: Ctx, f: GlobeFrame, P: GlobePalette): DrawResult {
  const R = (Math.min(f.width, f.height) / 2 - 24) * f.zoom;
  const cx = f.width / 2;
  const cy = f.height / 2;

  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(R)
    .rotate([f.rotation[0], f.rotation[1]])
    .clipAngle(90);
  const path = geoPath(projection, ctx);

  // Front-hemisphere test: projection() returns coords even for far-side
  // points (clipAngle only clips PATHS), so project a tiny circle and check
  // its clipped area survives.
  const testPath = geoPath(projection);
  const testCircle = geoCircle();
  const onFront = (lng: number, lat: number): boolean =>
    (testPath.area(testCircle.center([lng, lat]).radius(0.01)()) as number) > 0;

  ctx.clearRect(0, 0, f.width, f.height);

  // Ground shadow — sells the "physical globe on a desk" read.
  ctx.save();
  ctx.translate(cx, cy + R * 1.04);
  ctx.scale(1, 0.18);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.85);
  sh.addColorStop(0, "rgba(34,29,22,0.25)");
  sh.addColorStop(1, "rgba(34,29,22,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sphere with soft top-left light.
  const light = ctx.createRadialGradient(
    cx - R * 0.35, cy - R * 0.4, R * 0.1,
    cx, cy, R * 1.05,
  );
  light.addColorStop(0, "#f6f0e2");
  light.addColorStop(0.55, P.vellumDeep);
  light.addColorStop(1, "#d5c8ab");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Graticule.
  ctx.strokeStyle = withAlpha(P.rule, 0.7);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  path(geoGraticule10());
  ctx.stroke();

  // Land.
  ctx.fillStyle = P.land;
  ctx.strokeStyle = P.soft;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  path(f.land);
  ctx.fill();
  ctx.stroke();

  // Modern borders: hairline dashed ink — a faint chart annotation under the
  // pigment circles, which must stay visually dominant.
  if (f.modern?.enabled) {
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = withAlpha(P.soft, 0.4);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    path(f.modern.borders);
    ctx.stroke();
    ctx.restore(); // restores the empty dash list
  }

  // Spheres of influence — big first (painter's order from mappablePeriods).
  const circle = geoCircle();
  const heartlands: DrawResult["heartlands"] = [];
  const deferred: Array<{ name: string; x: number; y: number; pig: string; ghosted: boolean }> = [];
  for (const p of mappablePeriods(f.periods, f.year)) {
    const pig = P.pigment(p.region);
    // Two independent dimensions: life fade (birth/death) drives BOTH radius
    // and alpha; the lens drives alpha ONLY — a ghosted empire keeps its true
    // size, it just recedes. Ghost stroke gets a floor so outlines stay
    // legible as context.
    const fade = lifeFade(p, f.year);
    const la = lensAlpha(p.id, f.lensPeriodIds);
    const ghosted = la < 1;
    const fillA = fade * (ghosted ? 0.35 : 1);
    const deg = kmToDegrees(p.influence_km ?? 800) * (0.4 + 0.6 * fade);
    circle.center([p.center_lng!, p.center_lat!]);

    // Halo, then core.
    for (const [radius, alpha] of [
      [deg * 1.18, 0.10 * fillA],
      [deg, 0.26 * fillA],
    ] as const) {
      circle.radius(radius);
      ctx.fillStyle = withAlpha(pig, alpha);
      ctx.beginPath();
      path(circle());
      ctx.fill();
    }
    circle.radius(deg);
    ctx.strokeStyle = withAlpha(pig, Math.max(ghosted ? 0.3 : 0, 0.9 * fade * (ghosted ? 0.5 : 1)));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    path(circle());
    ctx.stroke();

    // Heartland marker + name (only when on the visible hemisphere) —
    // DEFERRED to a final pass so the serif labels always sit on top of the
    // circle fills and the (subordinate) modern country labels.
    const pt = projection([p.center_lng!, p.center_lat!]);
    if (pt && onFront(p.center_lng!, p.center_lat!)) {
      deferred.push({ name: p.name, x: pt[0], y: pt[1], pig, ghosted });
      heartlands.push({ id: p.id, name: p.name, x: pt[0], y: pt[1], region: p.region });
    }
  }

  // Modern country labels: after the circles so they stay readable over the
  // pigment fills, but styled to recede — tiny uppercase mono at low alpha,
  // clearly subordinate to the serif heartland labels. Same vellum halo
  // technique; never lens-ghosted, never year-faded.
  if (f.modern?.enabled) {
    ctx.save();
    ctx.font = "9px ui-monospace, Menlo, Consolas, 'Courier New', monospace";
    ctx.textAlign = "center";
    for (const l of f.modern.labels) {
      if (!onFront(l.lng, l.lat)) continue;
      const pt = projection([l.lng, l.lat]);
      if (!pt) continue;
      const text = l.name.toUpperCase();
      ctx.strokeStyle = withAlpha("#f6f0e2", 0.8);
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, pt[0], pt[1]);
      ctx.fillStyle = withAlpha(P.soft, 0.55);
      ctx.fillText(text, pt[0], pt[1]);
    }
    ctx.restore(); // restores textAlign for anything drawn after
  }

  // Heartland markers + serif names, above everything the circles laid down.
  for (const h of deferred) {
    ctx.globalAlpha = h.ghosted ? 0.35 : 1;
    ctx.fillStyle = h.pig;
    ctx.strokeStyle = "#f6f0e2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = "600 14px 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
    ctx.fillStyle = P.ink;
    ctx.strokeStyle = withAlpha("#f6f0e2", 0.85);
    ctx.lineWidth = 3;
    ctx.strokeText(h.name, h.x + 9, h.y - 8);
    ctx.fillText(h.name, h.x + 9, h.y - 8);
    ctx.globalAlpha = 1;
  }

  // Event pulses: expanding, fading rings.
  for (const e of visibleEvents(f.events, f.year)) {
    const pt = projection([e.lng!, e.lat!]);
    if (!pt || !onFront(e.lng!, e.lat!)) continue;
    const [x, y] = pt;
    const pig = P.pigment(e.region);
    const la = lensAlpha(e.id, f.lensEventIds);
    const grow = 6 + (1 - e.intensity) * 22;
    ctx.strokeStyle = withAlpha(pig, e.intensity * la);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, grow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = withAlpha(pig, Math.min(1, e.intensity + 0.15) * la);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return { heartlands };
}
