import Link from "next/link";
import { notFound } from "next/navigation";
import { getPeriodDetail } from "@/db/queries";
import { commonsImageUrl } from "@/lib/enrich";
import { formatYear, formatYearWithCertainty } from "@/lib/dates";
import {
  REGION_LABEL,
  RegionTick,
  PeriodYears,
  ConcurrentRail,
} from "../../components";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPeriodDetail(id);
  if (!detail) return { title: "Not found — historian" };
  const { period } = detail;
  return {
    title: `${period.name} — historian`,
    description: period.summary ?? `${period.name} in the historian atlas.`,
    openGraph: {
      title: period.name,
      description: period.summary ?? undefined,
      type: "article",
    },
  };
}

export default async function PeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPeriodDetail(id);
  if (!detail) notFound();

  const { period, parent, successors, people, events, concurrent } = detail;

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-10">
      <article className="space-y-10 min-w-0">
        <header>
          <p className="eyebrow flex items-center gap-2 mb-2">
            <RegionTick region={period.region} />
            {period.kind} · {REGION_LABEL[period.region]}
          </p>
          <h1 className="text-4xl">{period.name}</h1>
          <p className="mt-1">
            <PeriodYears p={period} dual />
          </p>
          {period.summary && (
            <p className="mt-4 max-w-2xl text-(--color-ink-soft)">
              {period.summary}
            </p>
          )}
          {period.enrichment?.imageFile && (
            <figure className="mt-6 max-w-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={commonsImageUrl(period.enrichment.imageFile, 900)}
                alt={period.name}
                className="w-full border border-(--color-rule)"
              />
              <figcaption className="eyebrow mt-1.5">
                image via wikimedia commons
                {period.enrichment.description
                  ? ` · ${period.enrichment.description}`
                  : ""}
              </figcaption>
            </figure>
          )}
        </header>

        {(parent || successors.length > 0) && (
          <section>
            <h2 className="eyebrow mb-3">Succession</h2>
            <p className="text-sm">
              {parent && (
                <>
                  Succeeded{" "}
                  <Link href={`/periods/${parent.id}`} className="underline">
                    {parent.name}
                  </Link>
                  {successors.length > 0 && " · "}
                </>
              )}
              {successors.length > 0 && (
                <>
                  Succeeded by{" "}
                  {successors.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ", "}
                      <Link href={`/periods/${s.id}`} className="underline">
                        {s.name}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </p>
          </section>
        )}

        {people.length > 0 && (
          <section>
            <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
              People
            </h2>
            <ul className="space-y-4">
              {people.map((p) => (
                <li key={p.id}>
                  <div className="flex items-baseline gap-3">
                    <Link
                      href={`/people/${p.id}`}
                      className="font-(family-name:--font-display) text-lg hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="eyebrow">{p.role}</span>
                    {p.birth_year !== null && (
                      <span className="year ml-auto">
                        {formatYearWithCertainty(p.birth_year, p.birth_certainty)}
                        {" – "}
                        {p.death_year !== null
                          ? formatYearWithCertainty(p.death_year, p.death_certainty)
                          : ""}
                      </span>
                    )}
                  </div>
                  {p.influence && (
                    <p className="text-sm text-(--color-ink-soft) max-w-2xl">
                      {p.influence}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {events.length > 0 && (
          <section>
            <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
              Events
            </h2>
            <ul className="space-y-4">
              {events.map((e) => (
                <li key={e.id}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-(family-name:--font-display) text-lg">
                      {e.name}
                    </span>
                    <span className="year ml-auto">
                      {formatYear(e.start_year)}
                      {e.end_year && e.end_year !== e.start_year
                        ? ` – ${formatYear(e.end_year)}`
                        : ""}
                    </span>
                  </div>
                  {e.summary && (
                    <p className="text-sm text-(--color-ink-soft) max-w-2xl">
                      {e.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <ConcurrentRail periods={concurrent.periods} events={concurrent.events} />
    </div>
  );
}
