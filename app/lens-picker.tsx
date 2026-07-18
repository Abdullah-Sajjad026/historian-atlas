/**
 * Lens picker: pill row for switching the active lens on /timeline and
 * /world via the ?lens= query param. Server component — pure links, no state.
 */

import Link from "next/link";

export interface LensOption {
  id: string;
  name: string;
}

export function LensPicker({
  basePath,
  themes,
  active,
}: {
  basePath: string;
  themes: LensOption[];
  active: string | null;
}) {
  const pill = (selected: boolean) =>
    `px-3 py-1 text-sm border ${
      selected
        ? "bg-(--color-ink) text-(--color-vellum) border-(--color-ink)"
        : "border-(--color-rule) hover:border-(--color-ink)"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1">lens</span>
      <Link href={basePath} className={pill(active === null)}>
        The whole world
      </Link>
      {themes.map((t) => (
        <Link
          key={t.id}
          href={`${basePath}?lens=${t.id}`}
          className={pill(active === t.id)}
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
}
