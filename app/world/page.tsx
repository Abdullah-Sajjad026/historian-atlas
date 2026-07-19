import { client } from "@/db/client";
import {
  resolveEndpoints,
  rotationForPoint,
  clampYear,
  clampCoord,
  type GlobePeriod,
  type GlobeEvent,
  type GlobePerson,
  type ResolvedLink,
} from "@/lib/globe";
import type { GlobeView } from "@/lib/globe-draw";
import { personRole } from "@/db/schema";
import {
  getAllThemes,
  getThemeEntityIds,
  getGlobePeople,
  getGlobeLinks,
} from "@/db/queries";
import { LensPicker } from "../lens-picker";
import GlobeClient from "./globe-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "The world — historian" };

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<{
    lens?: string;
    modern?: string;
    view?: string;
    genre?: string;
    civ?: string;
    links?: string;
    year?: string;
    focus?: string;
    lat?: string;
    lng?: string;
  }>;
}) {
  const { lens, modern, view, genre, civ, links, year, focus, lat, lng } =
    await searchParams;
  const periods = await client<GlobePeriod[]>`
    SELECT id, name, region, start_year, end_year, center_lat, center_lng,
           influence_km, importance FROM periods`;
  const events = await client<GlobeEvent[]>`
    SELECT id, name, start_year, region, lat, lng, importance FROM events`;
  const people = (await getGlobePeople()) as GlobePerson[];

  // Resolve connection endpoints server-side against the rows just loaded;
  // unresolvable links (seed already warned) are skipped, never a crash.
  const linkRows = await getGlobeLinks();
  const resolvedLinks: ResolvedLink[] = linkRows.flatMap((link) => {
    const eps = resolveEndpoints(link, { periods, people, events });
    return eps ? [{ link, a: eps[0], b: eps[1] }] : [];
  });

  const [themes, lensIds] = await Promise.all([
    getAllThemes(),
    lens ? getThemeEntityIds(lens) : Promise.resolve(null),
  ]);
  const activeLens = lensIds ? lens! : null;

  // URL params degrade like ?lens= does: unknown values fall back silently.
  const initialView: GlobeView =
    view === "people" || view === "both" ? view : "periods";
  const initialGenres = (genre ?? "")
    .split(",")
    .filter((g) => (personRole.enumValues as readonly string[]).includes(g));
  const initialCiv = periods.some((p) => p.id === civ) ? civ! : null;

  const minYear = Math.min(...periods.map((p) => p.start_year)) - 20;
  const maxYear =
    Math.max(...periods.map((p) => p.end_year ?? p.start_year + 50)) + 20;

  // ?year= arrives shareable: clamped into the scrubber's domain; anything
  // unparseable falls back to the same default the bare page uses.
  const initialYear = clampYear(year, minYear, maxYear) ?? 751;

  // ?focus=<period-slug> is an ENTRY HINT, resolved server-side to the
  // period's heartland. Unknown slug or a heartland-less period degrades
  // silently to the default rotation, like every other param on this page.
  const focusPeriod = focus ? periods.find((p) => p.id === focus) : undefined;
  const focusRotation =
    focusPeriod &&
    focusPeriod.center_lat !== null &&
    focusPeriod.center_lng !== null
      ? rotationForPoint(focusPeriod.center_lat, focusPeriod.center_lng)
      : null;

  // ?lat=&lng= is the entry hint for entities without a ?focus= slug (event
  // pages center their location this way). Clamped like every coordinate;
  // ?focus= wins when both are present — a named period is the more specific
  // intent. Either param missing or unparseable degrades silently, as above.
  const qLat = clampCoord(lat, 90);
  const qLng = clampCoord(lng, 180);
  const initialRotation =
    focusRotation ??
    (qLat !== null && qLng !== null ? rotationForPoint(qLat, qLng) : null);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-2">the world in a given year</p>
        <h1 className="text-4xl">Spin the year, watch empires breathe</h1>
        <p className="mt-3 max-w-2xl text-(--color-ink-soft)">
          Each pigment sphere is a civilization&rsquo;s reach around its
          heartland — deliberately spheres of influence, not precise borders.
          Switch to People and the humans of each age shine as stars. Press
          play and events flare where they happened.
        </p>
      </header>
      <LensPicker basePath="/world" themes={themes} active={activeLens} />
      <GlobeClient
        periods={periods}
        events={events}
        people={people}
        links={resolvedLinks}
        minYear={minYear}
        maxYear={maxYear}
        lensPeriodIds={lensIds?.periodIds ?? null}
        lensEventIds={lensIds?.eventIds ?? null}
        lensPersonIds={lensIds?.personIds ?? null}
        activeLens={activeLens}
        initialYear={initialYear}
        initialRotation={initialRotation}
        initialModern={modern === "1"}
        initialLinks={links !== "0"}
        initialView={initialView}
        initialGenres={initialGenres}
        initialCiv={initialCiv}
        genreOrder={personRole.enumValues}
      />
    </div>
  );
}
