import Link from "next/link";
import { getAllPeriods, getAllThemes } from "@/db/queries";
import type { Region } from "@/db/schema";
import { REGION_LABEL, RegionTick, PeriodRowItem } from "./components";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [periods, themes] = await Promise.all([getAllPeriods(), getAllThemes()]);

  // Group into region lanes — the same grouping the Phase 2 timeline will draw.
  const lanes = new Map<Region, typeof periods>();
  for (const p of periods) {
    const lane = lanes.get(p.region) ?? [];
    lane.push(p);
    lanes.set(p.region, lane);
  }

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-4xl md:text-5xl leading-tight max-w-3xl">
          History doesn&rsquo;t happen one place at a time.
        </h1>
        <p className="mt-4 max-w-2xl text-(--color-ink-soft)">
          While Baghdad&rsquo;s House of Wisdom translated Aristotle, Chang&rsquo;an
          was the largest city on earth. This atlas keeps every thread in view:
          pick any civilization, and the margin always shows you the rest of the
          world at that moment.
        </p>
      </section>

      <section className="space-y-8">
        <h2 className="text-2xl border-b border-(--color-rule) pb-2">
          Civilizations, by lane
        </h2>
        {[...lanes.entries()].map(([region, ps]) => (
          <div key={region}>
            <p className="eyebrow flex items-center gap-2 mb-1">
              <RegionTick region={region} /> {REGION_LABEL[region]}
            </p>
            <ul>
              {ps.map((p) => (
                <PeriodRowItem key={p.id} p={p} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl border-b border-(--color-rule) pb-2 mb-4">
          Lenses
        </h2>
        <ul className="space-y-3">
          {themes.map((t) => (
            <li key={t.id}>
              <Link
                href={`/themes/${t.id}`}
                className="font-(family-name:--font-display) text-lg hover:underline"
              >
                {t.name}
              </Link>
              {t.description && (
                <p className="text-sm text-(--color-ink-soft) max-w-xl">
                  {t.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
