import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonDetail } from "@/db/queries";
import { formatYear, formatYearWithCertainty } from "@/lib/dates";
import { RegionTick, PeriodYears, MeanwhileRail } from "../../components";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPersonDetail(id);
  if (!detail) return { title: "Not found — historian" };
  const { person } = detail;
  return {
    title: `${person.name} — historian`,
    description: person.influence ?? `${person.name} in the historian atlas.`,
    openGraph: {
      title: person.name,
      description: person.influence ?? undefined,
      type: "profile",
    },
  };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPersonDetail(id);
  if (!detail) notFound();

  const { person, memberships, meanwhile } = detail;

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-10">
      <article className="space-y-10 min-w-0">
        <header>
          <p className="eyebrow mb-2">
            {memberships.map((m) => m.role).join(" · ") || "person"}
          </p>
          <h1 className="text-4xl">{person.name}</h1>
          {person.birth_year !== null && (
            <p className="year mt-1">
              {formatYearWithCertainty(person.birth_year, person.birth_certainty)}
              {" – "}
              {person.death_year !== null
                ? formatYearWithCertainty(person.death_year, person.death_certainty)
                : ""}
            </p>
          )}
          {/* Deep link to the globe at mid-life (the meanwhile slice's year).
              No &focus= — people aren't periods; &view=both puts their star
              in the frame instead. */}
          {meanwhile && (
            <p className="eyebrow mt-3">
              <Link
                href={`/world?year=${meanwhile.year}&view=both`}
                className="hover:underline"
              >
                the world in {formatYear(meanwhile.year)} →
              </Link>
            </p>
          )}
          {person.influence && (
            <p className="mt-4 max-w-2xl">{person.influence}</p>
          )}
          {person.summary && (
            <p className="mt-3 max-w-2xl text-(--color-ink-soft)">
              {person.summary}
            </p>
          )}
        </header>

        {memberships.length > 0 && (
          <section>
            <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
              Belongs to
            </h2>
            <ul className="space-y-3">
              {memberships.map((m) => (
                <li key={`${m.id}-${m.role}`} className="flex items-baseline gap-3">
                  <RegionTick region={m.region} />
                  <Link href={`/periods/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                  <span className="eyebrow">{m.role}</span>
                  <span className="ml-auto">
                    <PeriodYears p={m} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {meanwhile && (
        <MeanwhileRail slice={meanwhile} heading="In their lifetime" />
      )}
    </div>
  );
}
