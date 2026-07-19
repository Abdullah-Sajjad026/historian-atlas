import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventDetail, type EventLinkRow } from "@/db/queries";
import { commonsImageUrl } from "@/lib/enrich";
import {
  formatYear,
  formatYearRange,
  formatYearWithCertainty,
} from "@/lib/dates";
import {
  REGION_LABEL,
  RegionTick,
  PeriodRowItem,
  MeanwhileRail,
} from "../../components";

export const dynamic = "force-dynamic";

/** Entity endpoints of a connection link to their own pages. */
const ENTITY_PATH = {
  period: "periods",
  person: "people",
  event: "events",
} as const;

/** An event's one certainty describes the whole date, so a range shows it on
 *  both endpoints ("c. 1519 – c. 1522"); a point event is a single year. */
function eventYears(e: {
  start_year: number;
  end_year: number | null;
  certainty: "exact" | "circa" | "disputed" | "unknown";
}): string {
  if (e.end_year === null || e.end_year === e.start_year) {
    return formatYearWithCertainty(e.start_year, e.certainty);
  }
  return formatYearRange({
    startYear: e.start_year,
    endYear: e.end_year,
    startCertainty: e.certainty,
    endCertainty: e.certainty,
  });
}

function linkYears(l: EventLinkRow): string {
  return l.end_year === null
    ? formatYear(l.start_year)
    : `${formatYear(l.start_year)} – ${formatYear(l.end_year)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) return { title: "Not found — historian" };
  const { event } = detail;
  return {
    title: `${event.name} — historian`,
    description: event.summary ?? `${event.name} in the historian atlas.`,
    openGraph: {
      title: event.name,
      description: event.summary ?? undefined,
      type: "article",
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const { event, periods, links, moment } = detail;

  // The globe door always carries the year (and keeps connections on — an
  // event page is a hub, arcs are its context); when the event has a
  // location, ?lat=&lng= centers the globe on it (an entry hint like
  // ?focus=, which wins if both are ever present).
  const worldHref =
    event.lat != null && event.lng != null
      ? `/world?year=${event.start_year}&links=1&lat=${event.lat}&lng=${event.lng}`
      : `/world?year=${event.start_year}&links=1`;

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-10">
      <article className="space-y-10 min-w-0">
        <header>
          <p className="eyebrow flex items-center gap-2 mb-2">
            <RegionTick region={event.region} />
            event · {REGION_LABEL[event.region]}
          </p>
          <h1 className="text-4xl">{event.name}</h1>
          <p className="year mt-1">{eventYears(event)}</p>
          <p className="eyebrow mt-3 flex flex-wrap gap-x-5">
            <Link href={worldHref} className="hover:underline">
              the world in {formatYear(event.start_year)} →
            </Link>
            <Link href="/timeline" className="hover:underline">
              on the timeline →
            </Link>
          </p>
          {event.summary && (
            <p className="mt-4 max-w-2xl text-(--color-ink-soft)">
              {event.summary}
            </p>
          )}
          {event.enrichment?.imageFile && (
            <figure className="mt-6 max-w-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={commonsImageUrl(event.enrichment.imageFile, 900)}
                alt={event.name}
                className="w-full border border-(--color-rule)"
              />
              <figcaption className="eyebrow mt-1.5">
                image via wikimedia commons
                {event.enrichment.description
                  ? ` · ${event.enrichment.description}`
                  : ""}
              </figcaption>
            </figure>
          )}
        </header>

        <section>
          <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
            Participants
          </h2>
          {periods.length === 0 ? (
            // Period-less events are deliberate content (the Hijra), not a
            // gap — see docs/gotchas.md "Events with zero periods are legal".
            <p className="text-sm text-(--color-ink-soft)">
              Predates every period in the atlas.
            </p>
          ) : (
            <ul>
              {periods.map((p) => (
                <PeriodRowItem key={p.id} p={p} />
              ))}
            </ul>
          )}
        </section>

        {links.length > 0 && (
          <section>
            <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
              Connections
            </h2>
            <ul className="space-y-4">
              {links.map((l) => (
                <li key={l.id}>
                  <div className="flex items-baseline gap-3">
                    <span className="eyebrow">{l.kind}</span>
                    {l.other.type === "place" ? (
                      <span className="font-(family-name:--font-display) text-lg">
                        {l.other.label ?? "a place"}
                      </span>
                    ) : (
                      <Link
                        href={`/${ENTITY_PATH[l.other.type]}/${l.other.id}`}
                        className="font-(family-name:--font-display) text-lg hover:underline"
                      >
                        {l.other.name}
                      </Link>
                    )}
                    <span className="year ml-auto">{linkYears(l)}</span>
                  </div>
                  {l.summary && (
                    <p className="text-sm text-(--color-ink-soft) max-w-2xl">
                      {l.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {/* Point-sample rail, deliberately: an event is a MOMENT, so the
          point-vs-overlap rule from docs/architecture.md ("point queries for
          people, overlap queries for periods") puts it with people, not
          periods — the range-overlap ConcurrentRail is for entities that
          span centuries. */}
      <MeanwhileRail slice={moment} heading="Meanwhile" />
    </div>
  );
}
