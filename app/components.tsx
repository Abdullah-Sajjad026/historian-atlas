/**
 * Shared server components. Small on purpose — Phase 1 has no client-side
 * interactivity, so everything renders on the server.
 *
 * The MeanwhileRail is the app's signature element: every entity page shows
 * the concurrent world in a slim chronology, ticked in region pigments.
 */

import Link from "next/link";
import type { Region } from "@/db/schema";
import type { TimeSlice, PeriodRow, EventRow } from "@/db/queries";
import { formatYear, formatYearRange, formatYearDual } from "@/lib/dates";

export const REGION_LABEL: Record<Region, string> = {
  "east-asia": "East Asia",
  "south-asia": "South Asia",
  mena: "Middle East & N. Africa",
  europe: "Europe",
  "sub-saharan-africa": "Sub-Saharan Africa",
  americas: "Americas",
  "steppe-central-asia": "Steppe & Central Asia",
};

/** Pigment lozenge for a region. Color comes from the token system. */
export function RegionTick({ region }: { region: Region }) {
  return (
    <span
      className="tick"
      style={{ background: `var(--color-${region})` }}
      aria-hidden
    />
  );
}

/** Period range in mono. dual=true adds the Hijri year (Islamic lens). */
export function PeriodYears({
  p,
  dual = false,
}: {
  p: Pick<PeriodRow, "start_year" | "end_year" | "start_certainty" | "end_certainty">;
  dual?: boolean;
}) {
  const label = formatYearRange({
    startYear: p.start_year,
    endYear: p.end_year,
    startCertainty: p.start_certainty,
    endCertainty: p.end_certainty,
  });
  if (!dual || p.start_year < 622) return <span className="year">{label}</span>;
  return (
    <span className="year">
      {label} · {formatYearDual(p.start_year).split(" / ")[1]}
      {p.end_year ? `–${formatYearDual(p.end_year).split(" / ")[1]}` : ""}
    </span>
  );
}

/** One row in any entity list: tick, linked name, years. */
export function PeriodRowItem({ p, dual }: { p: PeriodRow; dual?: boolean }) {
  return (
    <li className="flex items-baseline gap-3 py-2 border-b border-(--color-rule) last:border-0">
      <RegionTick region={p.region} />
      <Link
        href={`/periods/${p.id}`}
        className="font-(family-name:--font-display) text-lg hover:underline"
      >
        {p.name}
      </Link>
      <span className="eyebrow">{p.kind}</span>
      <span className="ml-auto">
        <PeriodYears p={p} dual={dual} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The Meanwhile rail
// ---------------------------------------------------------------------------

/** Period-page variant: concurrency by range overlap, not a point sample. */
export function ConcurrentRail({
  periods,
  events,
}: {
  periods: PeriodRow[];
  events: EventRow[];
}) {
  return (
    <aside className="border-l-2 border-(--color-rule) pl-5">
      <p className="eyebrow mb-1">Meanwhile</p>
      <h3 className="text-xl mb-4">Elsewhere, during this period</h3>

      {periods.length === 0 && events.length === 0 ? (
        <p className="text-sm text-(--color-ink-soft)">
          Nothing else in the atlas yet for this span — the spine is still
          growing.
        </p>
      ) : (
        <div className="space-y-5">
          {periods.length > 0 && (
            <ul className="space-y-2.5">
              {periods.map((p) => (
                <RailPeriod key={p.id} p={p} />
              ))}
            </ul>
          )}
          {events.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Events elsewhere</p>
              <ul className="space-y-2.5">
                {events.map((e) => (
                  <RailEvent key={e.id} e={e} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export function MeanwhileRail({
  slice,
  heading = "Meanwhile",
}: {
  slice: TimeSlice;
  heading?: string;
}) {
  return (
    <aside className="border-l-2 border-(--color-rule) pl-5">
      <p className="eyebrow mb-1">{heading}</p>
      <h3 className="text-xl mb-4">
        The world, <span className="year text-base">{formatYear(slice.year)}</span>
      </h3>

      {slice.periods.length === 0 && slice.events.length === 0 ? (
        <p className="text-sm text-(--color-ink-soft)">
          Nothing else in the atlas yet for this moment — the spine is still
          growing.
        </p>
      ) : (
        <div className="space-y-5">
          {slice.periods.length > 0 && (
            <ul className="space-y-2.5">
              {slice.periods.map((p) => (
                <RailPeriod key={p.id} p={p} />
              ))}
            </ul>
          )}
          {slice.events.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Within a generation</p>
              <ul className="space-y-2.5">
                {slice.events.map((e) => (
                  <RailEvent key={e.id} e={e} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function RailPeriod({ p }: { p: PeriodRow }) {
  return (
    <li className="flex items-baseline gap-2.5 text-sm">
      <RegionTick region={p.region} />
      <span>
        <Link href={`/periods/${p.id}`} className="hover:underline">
          {p.name}
        </Link>
        <span className="block text-xs text-(--color-ink-soft)">
          {REGION_LABEL[p.region]} · <PeriodYears p={p} />
        </span>
      </span>
    </li>
  );
}

function RailEvent({ e }: { e: EventRow }) {
  return (
    <li className="flex items-baseline gap-2.5 text-sm">
      <RegionTick region={e.region} />
      <span>
        {e.name}
        <span className="block text-xs text-(--color-ink-soft)">
          <span className="year">{formatYear(e.start_year)}</span>
        </span>
      </span>
    </li>
  );
}
