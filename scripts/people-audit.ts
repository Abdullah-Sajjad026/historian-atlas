/** Verify person threads: recompute layout for the rendered window, then
 *  pixel-sample the PNG at each thread's center to prove paint happened. */
import { scaleLinear } from "d3-scale";
import { createCanvas, loadImage } from "canvas";
import { client } from "@/db/client";
import type { PeriodRow, EventRow } from "@/db/queries";
import { buildLanes, layoutTimeline, METRICS, type TimelinePerson } from "@/lib/timeline-layout";

async function main() {
  const periods = await client<PeriodRow[]>`SELECT * FROM periods ORDER BY start_year`;
  const events = await client<EventRow[]>`SELECT * FROM events ORDER BY start_year`;
  const people = await client<TimelinePerson[]>`
    SELECT DISTINCT ON (p.id) p.id, p.name, p.birth_year, p.death_year, p.importance, per.region
    FROM people p JOIN period_people pp ON pp.person_id = p.id
    JOIN periods per ON per.id = pp.period_id
    WHERE p.birth_year IS NOT NULL ORDER BY p.id, per.start_year ASC`;

  const width = 1200, domain: [number, number] = [740, 1000];
  const x = scaleLinear().domain(domain).range([0, width]);
  const layout = layoutTimeline(buildLanes(periods), events, (yr) => x(yr), width / 260, people);

  const img = await loadImage("/tmp/timeline-people.png");
  const cv = createCanvas(img.width, img.height);
  const cctx = cv.getContext("2d");
  cctx.drawImage(img, 0, 0);

  const bg = [0xef, 0xe8, 0xd8]; // vellum
  let painted = 0, offscreen = 0;
  for (const p of layout.personBoxes) {
    const cx = Math.round(p.x + Math.min(p.w / 2, 20));
    const cy = Math.round(p.y + p.h / 2);
    if (cx < 0 || cx >= img.width) { offscreen++; continue; }
    const d = cctx.getImageData(cx, cy, 1, 1).data;
    const differs = Math.abs(d[0]! - bg[0]!) + Math.abs(d[1]! - bg[1]!) + Math.abs(d[2]! - bg[2]!) > 20;
    if (differs) painted++;
    else console.log(`  NOT PAINTED: ${p.name} at (${cx},${cy}) rgb(${d[0]},${d[1]},${d[2]})`);
  }
  console.log(`threads painted: ${painted}/${layout.personBoxes.length - offscreen} on-screen (${offscreen} off-screen)`);

  // Sample one known thread + name it
  const harun = layout.personBoxes.find((b) => b.id === "harun-al-rashid");
  if (harun) {
    const d = cctx.getImageData(Math.round(harun.x + 10), Math.round(harun.y + harun.h / 2), 1, 1).data;
    console.log(`harun-al-rashid thread rgb(${d[0]},${d[1]},${d[2]}) — expect lapis-tinted (~mena pigment on vellum)`);
  }
  await client.end();
}
main();
