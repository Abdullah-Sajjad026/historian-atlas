/**
 * Render the timeline to PNG using the REAL layout + REAL draw module
 * (src/lib/timeline-draw.ts, shared verbatim with the browser client) against
 * live DB data — a true visual regression of the shipped renderer.
 *
 * Usage: DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-preview.ts
 * Writes: /tmp/timeline-overview.png and /tmp/timeline-zoomed.png
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "node:fs";
import { scaleLinear } from "d3-scale";
import { client } from "@/db/client";
import { bce } from "@/lib/dates";
import type { PeriodRow, EventRow } from "@/db/queries";
import { buildLanes, layoutTimeline, type TimelinePerson } from "@/lib/timeline-layout";
import { drawTimeline, type TimelinePalette } from "@/lib/timeline-draw";

const PIG: Record<string, string> = {
  "east-asia": "#b23a2b",
  "south-asia": "#c4881b",
  mena: "#2d5c8f",
  europe: "#47786b",
  "sub-saharan-africa": "#a65e2e",
  americas: "#8e3b52",
  "steppe-central-asia": "#6e7f4c",
};
const REGION_LABEL: Record<string, string> = {
  "east-asia": "EAST ASIA",
  "south-asia": "SOUTH ASIA",
  mena: "MIDDLE EAST & N. AFRICA",
  europe: "EUROPE",
  "sub-saharan-africa": "SUB-SAHARAN AFRICA",
  americas: "AMERICAS",
  "steppe-central-asia": "STEPPE & CENTRAL ASIA",
};
const palette: TimelinePalette = {
  ink: "#221d16",
  soft: "#5c5344",
  rule: "#cfc3a9",
  barText: "#F5F0E4",
  pigment: (r) => PIG[r] ?? "#5c5344",
  laneLabel: (r) => REGION_LABEL[r] ?? r.toUpperCase(),
};

async function render(width: number, domain: [number, number], out: string) {
  const periods = await client<PeriodRow[]>`SELECT * FROM periods ORDER BY start_year`;
  const events = await client<EventRow[]>`SELECT * FROM events ORDER BY start_year`;
  const people = await client<TimelinePerson[]>`
    SELECT DISTINCT ON (p.id) p.id, p.name, p.birth_year, p.death_year,
      p.importance, per.region
    FROM people p
    JOIN period_people pp ON pp.person_id = p.id
    JOIN periods per ON per.id = pp.period_id
    WHERE p.birth_year IS NOT NULL
    ORDER BY p.id, per.start_year ASC`;

  const lanes = buildLanes(periods);
  const x = scaleLinear().domain(domain).range([0, width]);
  const pxPerYear = width / (domain[1] - domain[0]);
  const layout = layoutTimeline(lanes, events, (yr) => x(yr), pxPerYear, people);

  const height = Math.max(layout.totalHeight + 8, 200);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#efe8d8";
  ctx.fillRect(0, 0, width, height);
  ctx.font = "13px Georgia"; // node-canvas lacks the display serif; Georgia measures close

  drawTimeline(
    ctx,
    {
      width,
      height,
      ticks: x.ticks(Math.max(3, Math.floor(width / 110))),
      xOf: (yr) => x(yr),
      layout,
      fonts: { mono: "11px monospace", label: "13px Georgia", person: "10px monospace" },
    },
    palette,
  );

  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(
    `wrote ${out}  (${width}x${height}, ${pxPerYear.toFixed(2)} px/yr, ${layout.boxes.length} bars, ${layout.personBoxes.length} people, ${layout.eventBoxes.length} events)`,
  );
}

async function main() {
  await render(1200, [bce(400), 100], "/tmp/timeline-bce.png"); // BCE window: axis must say "300 BCE", not "-299"
  await render(1200, [230, 1950], "/tmp/timeline-overview.png"); // full atlas span
  await render(1200, [600, 1100], "/tmp/timeline-crowded.png"); // dense MENA/Europe window
  await render(1200, [740, 1000], "/tmp/timeline-people.png"); // human scale: lifespan threads
  await client.end();
}
main();
