import { client } from "@/db/client";
import type { GlobePeriod, GlobeEvent } from "@/lib/globe";
import { getAllThemes, getThemeEntityIds } from "@/db/queries";
import { LensPicker } from "../lens-picker";
import GlobeClient from "./globe-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "The world — historian" };

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<{ lens?: string; modern?: string }>;
}) {
  const { lens, modern } = await searchParams;
  const periods = await client<GlobePeriod[]>`
    SELECT id, name, region, start_year, end_year, center_lat, center_lng,
           influence_km, importance FROM periods`;
  const events = await client<GlobeEvent[]>`
    SELECT id, name, start_year, region, lat, lng, importance FROM events`;

  const [themes, lensIds] = await Promise.all([
    getAllThemes(),
    lens ? getThemeEntityIds(lens) : Promise.resolve(null),
  ]);
  const activeLens = lensIds ? lens! : null;

  const minYear = Math.min(...periods.map((p) => p.start_year)) - 20;
  const maxYear =
    Math.max(...periods.map((p) => p.end_year ?? p.start_year + 50)) + 20;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-2">the world in a given year</p>
        <h1 className="text-4xl">Spin the year, watch empires breathe</h1>
        <p className="mt-3 max-w-2xl text-(--color-ink-soft)">
          Each pigment sphere is a civilization&rsquo;s reach around its
          heartland — deliberately spheres of influence, not precise borders.
          Press play and events flare where they happened.
        </p>
      </header>
      <LensPicker basePath="/world" themes={themes} active={activeLens} />
      <GlobeClient
        periods={periods}
        events={events}
        minYear={minYear}
        maxYear={maxYear}
        lensPeriodIds={lensIds?.periodIds ?? null}
        lensEventIds={lensIds?.eventIds ?? null}
        initialModern={modern === "1"}
      />
    </div>
  );
}
