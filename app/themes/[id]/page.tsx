import Link from "next/link";
import { notFound } from "next/navigation";
import { getThemeDetail } from "@/db/queries";
import { formatYear, formatYearWithCertainty } from "@/lib/dates";
import { RegionTick, PeriodRowItem } from "../../components";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getThemeDetail(id);
  if (!detail) return { title: "Not found — historian" };
  return {
    title: `${detail.theme.name} — historian`,
    description: detail.theme.description ?? undefined,
  };
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getThemeDetail(id);
  if (!detail) notFound();

  const { theme, periods, people, events } = detail;
  const dual = theme.calendar_mode === "dual-hijri";

  return (
    <div className="space-y-12">
      <header>
        <p className="eyebrow mb-2">lens</p>
        <h1 className="text-4xl">{theme.name}</h1>
        {theme.description && (
          <p className="mt-4 max-w-2xl text-(--color-ink-soft)">
            {theme.description}
          </p>
        )}
        {dual && (
          <p className="eyebrow mt-2">years shown as CE · AH (approximate)</p>
        )}
        <p className="mt-4 flex gap-3 text-sm">
          <Link
            href={`/timeline?lens=${theme.id}`}
            className="border border-(--color-ink) px-3 py-1 hover:bg-(--color-vellum-deep)"
          >
            View on the timeline
          </Link>
          <Link
            href={`/world?lens=${theme.id}`}
            className="border border-(--color-ink) px-3 py-1 hover:bg-(--color-vellum-deep)"
          >
            Spin the globe
          </Link>
        </p>
      </header>

      {periods.length > 0 && (
        <section>
          <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-2">
            Periods
          </h2>
          <ul>
            {periods.map((p) => (
              <PeriodRowItem key={p.id} p={p} dual={dual} />
            ))}
          </ul>
        </section>
      )}

      {people.length > 0 && (
        <section>
          <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
            People
          </h2>
          <ul className="space-y-3">
            {people.map((p) => (
              <li key={p.id}>
                <div className="flex items-baseline gap-3">
                  <Link
                    href={`/people/${p.id}`}
                    className="font-(family-name:--font-display) text-lg hover:underline"
                  >
                    {p.name}
                  </Link>
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
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3">
                <RegionTick region={e.region} />
                <span>{e.name}</span>
                <span className="year ml-auto">{formatYear(e.start_year)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
