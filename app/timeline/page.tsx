import { getAllPeriods, getAllEvents, getAllThemes, getThemeEntityIds, getTimelinePeople } from "@/db/queries";
import { LensPicker } from "../lens-picker";
import TimelineClient from "./timeline-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Timeline — historian" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ lens?: string }>;
}) {
  const { lens } = await searchParams;
  const [periods, events, people, themes, lensIds] = await Promise.all([
    getAllPeriods(),
    getAllEvents(),
    getTimelinePeople(),
    getAllThemes(),
    lens ? getThemeEntityIds(lens) : Promise.resolve(null),
  ]);
  const activeLens = lensIds ? lens! : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-2">parallel timeline</p>
        <h1 className="text-4xl">Every lane at once</h1>
        <p className="mt-3 max-w-2xl text-(--color-ink-soft)">
          Each lane is a region; each bar a dynasty, empire, or caliphate.
          Zoom in and more of the record surfaces — lesser dynasties, events
          as lozenges on the lane floor, and at human scale, lifespans as
          threads beneath their civilizations.
        </p>
      </header>
      <LensPicker basePath="/timeline" themes={themes} active={activeLens} />
      <TimelineClient
        periods={periods}
        events={events}
        people={people}
        lensPeriodIds={lensIds?.periodIds ?? null}
        lensEventIds={lensIds?.eventIds ?? null}
      />
    </div>
  );
}
