/**
 * Globe preview — renders frames through the SAME drawGlobe used by the
 * browser client. Usage:
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-globe.ts
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldData from "world-atlas/land-110m.json";
import countriesData from "world-atlas/countries-110m.json";
import { client } from "@/db/client";
import { getGlobePeople } from "@/db/queries";
import { bce } from "@/lib/dates";
import { filterPeople, type GlobePeriod, type GlobeEvent, type GlobePerson } from "@/lib/globe";
import { drawGlobe, type GlobePalette, type GlobeView } from "@/lib/globe-draw";
import { selectCountryLabels, type CountryFeature } from "@/lib/modern-borders";

const world = worldData as unknown as Topology<{ land: GeometryCollection }>;
const land = feature(world, world.objects.land);

const countriesTopo = countriesData as unknown as Topology<{ countries: GeometryCollection }>;
const countryBorders = mesh(countriesTopo, countriesTopo.objects.countries, (a, b) => a !== b);
const countryLabels = selectCountryLabels(
  feature(countriesTopo, countriesTopo.objects.countries).features as CountryFeature[],
);

const PIG: Record<string, string> = {
  "east-asia": "#b23a2b",
  "south-asia": "#c4881b",
  mena: "#2d5c8f",
  europe: "#47786b",
  "sub-saharan-africa": "#a65e2e",
  americas: "#8e3b52",
  "steppe-central-asia": "#6e7f4c",
};
const palette: GlobePalette = {
  vellum: "#efe8d8",
  vellumDeep: "#e6dcc6",
  ink: "#221d16",
  soft: "#5c5344",
  rule: "#cfc3a9",
  land: "#e3d7bc",
  pigment: (r) => PIG[r] ?? "#5c5344",
};

async function main() {
  const periods = await client<GlobePeriod[]>`
    SELECT id, name, region, start_year, end_year, center_lat, center_lng,
           influence_km, importance FROM periods`;
  const events = await client<GlobeEvent[]>`
    SELECT id, name, start_year, region, lat, lng, importance FROM events`;

  const people = (await getGlobePeople()) as GlobePerson[];

  const lensRows = await client<Array<{ entity_type: string; entity_id: string }>>`
    SELECT entity_type, entity_id FROM theme_memberships WHERE theme_id = 'islamic-history'`;
  const lensPeriodIds = new Set(lensRows.filter((r) => r.entity_type === "period").map((r) => r.entity_id));
  const lensEventIds = new Set(lensRows.filter((r) => r.entity_type === "event").map((r) => r.entity_id));
  const lensPersonIds = new Set(lensRows.filter((r) => r.entity_type === "person").map((r) => r.entity_id));

  const frames: Array<{
    year: number;
    rotation: [number, number];
    out: string;
    lens?: boolean;
    modern?: boolean;
    view?: GlobeView;
    genres?: string[];
    civ?: string;
  }> = [
    { year: bce(250), rotation: [-85, -20], out: "/tmp/globe-bce250.png" }, // Maurya heartland; Kalinga pulse fading
    { year: 900, rotation: [-45, -25], out: "/tmp/globe-900.png" }, // five civs across Afro-Eurasia
    { year: 800, rotation: [90, -15], out: "/tmp/globe-maya-800.png" }, // the Americas lane
    { year: 1455, rotation: [-40, -30], out: "/tmp/globe-1455.png" }, // Ottoman risen, Byzantium just fell
    { year: 900, rotation: [-45, -25], out: "/tmp/globe-900-lens.png", lens: true }, // islamic lens: spotlight
    { year: 900, rotation: [-45, -25], out: "/tmp/globe-900-modern.png", modern: true }, // modern borders vs Abbasid/Tang
    { year: 900, rotation: [-45, -25], out: "/tmp/globe-900-lens-modern.png", lens: true, modern: true }, // overlay must NOT ghost
    // People view + facets — the two spec scenarios from the faceted-filter work:
    // scholars in 1000 must include al-Zahrawi (Córdoba) but not al-Ghazali
    // (born 1058) and must drop Basil II (a ruler); rulers in 1000 invert that.
    { year: 1000, rotation: [-30, -30], out: "/tmp/globe-1000-people-scholars.png", view: "people", genres: ["scholar"] },
    { year: 1000, rotation: [-30, -30], out: "/tmp/globe-1000-people-rulers.png", view: "people", genres: ["ruler"] },
    { year: 1180, rotation: [-45, -25], out: "/tmp/globe-1180-both.png", view: "both" }, // stars over circles
    { year: 1000, rotation: [-30, -30], out: "/tmp/globe-1000-people-lens.png", view: "people", lens: true }, // lens DIMS people, facets FILTER
    // The marquee: 800 CE, Charlemagne (Aachen) and Harun al-Rashid (Baghdad)
    // shining on one hemisphere, with the Baghdad fan-out (Harun + al-Khwarizmi
    // + a 14-year-old al-Ma'mun at partial personFade).
    { year: 800, rotation: [-30, -35], out: "/tmp/globe-800-people.png", view: "people" },
  ];

  for (const fr of frames) {
    const size = 900;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    // page background behind the sphere
    ctx.fillStyle = palette.vellum;
    ctx.fillRect(0, 0, size, size);
    const res = drawGlobe(
      ctx,
      {
        width: size, height: size, rotation: fr.rotation, zoom: 1, year: fr.year,
        periods, events, land,
        view: fr.view,
        // Same composition as the client: facets FILTER the people set...
        people: filterPeople(people, { genres: fr.genres, periodIds: fr.civ ? [fr.civ] : undefined }),
        lensPeriodIds: fr.lens ? lensPeriodIds : undefined,
        lensEventIds: fr.lens ? lensEventIds : undefined,
        // ...while the lens only DIMS them.
        lensPersonIds: fr.lens ? lensPersonIds : undefined,
        modern: fr.modern
          ? { enabled: true, borders: countryBorders, labels: countryLabels }
          : undefined,
      },
      palette,
    );
    writeFileSync(fr.out, canvas.toBuffer("image/png"));
    console.log(`wrote ${fr.out} — year ${fr.year}, heartlands: ${res.heartlands.map((h) => h.name).join(", ")}`);
    if (fr.view) console.log(`  stars: ${res.stars.map((h) => h.name).join(", ") || "(none)"}`);
  }
  await client.end();
}
main();
