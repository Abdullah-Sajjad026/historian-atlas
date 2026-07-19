"use client";

/**
 * Interactive globe. All painting is src/lib/globe-draw.ts (shared with the
 * preview script); this component owns only interaction state: rotation drag,
 * wheel zoom, the year scrubber, play mode, view/facet state, and
 * heartland/star click-through.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldData from "world-atlas/land-110m.json";
import countriesData from "world-atlas/countries-110m.json";
import type { Region } from "@/db/schema";
import {
  activeAt,
  visibleEvents,
  personAliveAt,
  filterPeople,
  linkAlpha,
  linkLensAlpha,
  MAX_PHI,
  type GlobePeriod,
  type GlobeEvent,
  type GlobePerson,
  type ResolvedLink,
  type LinkKind,
} from "@/lib/globe";
import {
  drawGlobe,
  type GlobePalette,
  type DrawResult,
  type GlobeView,
} from "@/lib/globe-draw";
import { selectCountryLabels, type CountryFeature } from "@/lib/modern-borders";
import { formatYearDual, formatYear } from "@/lib/dates";
import { REGION_LABEL, RegionTick } from "../components";

const world = worldData as unknown as Topology<{ land: GeometryCollection }>;
const land = feature(world, world.objects.land);

// Modern overlay data — constant, so converted and label-selected once at
// module scope, same pattern as land above.
const countriesTopo = countriesData as unknown as Topology<{ countries: GeometryCollection }>;
const countryBorders = mesh(countriesTopo, countriesTopo.objects.countries, (a, b) => a !== b);
const countryLabels = selectCountryLabels(
  feature(countriesTopo, countriesTopo.objects.countries).features as CountryFeature[],
);

const PLAY_YEARS_PER_SEC = 14;

const VIEW_LABEL: Record<GlobeView, string> = {
  periods: "Empires",
  people: "People",
  both: "Both",
};

/** Mono kind glyphs for the Connections panel (X = transmission/exchange). */
const KIND_GLYPH: Record<LinkKind, string> = {
  embassy: "E",
  war: "W",
  trade: "T",
  journey: "J",
  transmission: "X",
};

/** First clause of a link summary — up to the first semicolon or em-dash. */
function firstClause(summary: string | null): string {
  return (summary ?? "").split(/[;—]/)[0]!.trim();
}

interface Props {
  periods: GlobePeriod[];
  events: GlobeEvent[];
  people: GlobePerson[];
  /** Connections, endpoint-resolved server-side. NOT faceted — facets narrow
   *  people only; the lens dims arcs via linkLensAlpha. */
  links: ResolvedLink[];
  minYear: number;
  maxYear: number;
  lensPeriodIds: string[] | null;
  lensEventIds: string[] | null;
  lensPersonIds: string[] | null;
  /** Active lens id (validated server-side) so the timeline bridge link can
   *  carry ?lens= across; null = no lens. */
  activeLens: string | null;
  /** Initial scrubbed year (?year=, already clamped server-side). */
  initialYear: number;
  /** Initial rotation from ?focus= (a period's heartland via
   *  rotationForPoint); null = the default rotation. */
  initialRotation: [number, number] | null;
  /** Initial state of the modern-borders overlay (?modern=1). */
  initialModern: boolean;
  /** Initial state of the connections layer (?links=0 hides; absent = on). */
  initialLinks: boolean;
  /** Initial view mode (?view=people|both; absent = periods). */
  initialView: GlobeView;
  /** Initial facets (?genre=a,b — pre-validated; ?civ=<period-id>). */
  initialGenres: string[];
  initialCiv: string | null;
  /** Role-enum order, so genre chips render in a stable canonical order. */
  genreOrder: readonly string[];
}

function readPalette(): GlobePalette {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  const pig: Record<string, string> = {
    "east-asia": v("--color-east-asia"),
    "south-asia": v("--color-south-asia"),
    mena: v("--color-mena"),
    europe: v("--color-europe"),
    "sub-saharan-africa": v("--color-sub-saharan-africa"),
    americas: v("--color-americas"),
    "steppe-central-asia": v("--color-steppe-central-asia"),
  };
  return {
    vellum: v("--color-vellum"),
    vellumDeep: v("--color-vellum-deep"),
    ink: v("--color-ink"),
    soft: v("--color-ink-soft"),
    rule: v("--color-rule"),
    land: "#e3d7bc",
    pigment: (r) => pig[r] ?? v("--color-ink-soft"),
  };
}

export default function GlobeClient({
  periods,
  events,
  people,
  links,
  minYear,
  maxYear,
  lensPeriodIds,
  lensEventIds,
  lensPersonIds,
  activeLens,
  initialYear,
  initialRotation,
  initialModern,
  initialLinks,
  initialView,
  initialGenres,
  initialCiv,
  genreOrder,
}: Props) {
  const lensP = useMemo(
    () => (lensPeriodIds ? new Set(lensPeriodIds) : undefined),
    [lensPeriodIds],
  );
  const lensE = useMemo(
    () => (lensEventIds ? new Set(lensEventIds) : undefined),
    [lensEventIds],
  );
  const lensPer = useMemo(
    () => (lensPersonIds ? new Set(lensPersonIds) : undefined),
    [lensPersonIds],
  );
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(initialYear);
  const [playing, setPlaying] = useState(false);
  const [modern, setModern] = useState(initialModern);
  const [showLinks, setShowLinks] = useState(initialLinks);
  const [view, setView] = useState<GlobeView>(initialView);
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [civ, setCiv] = useState<string | null>(initialCiv);

  // Facets FILTER the people set (stars AND panel); the lens only DIMS.
  const filtered = useMemo(
    () =>
      filterPeople(people, {
        genres,
        periodIds: civ ? [civ] : undefined,
      }),
    [people, genres, civ],
  );

  // Only offer genre chips that exist in the loaded dataset.
  const availableGenres = useMemo(() => {
    const present = new Set(people.flatMap((p) => p.roles));
    return genreOrder.filter((g) => present.has(g));
  }, [people, genreOrder]);

  // Civilization options double-use the globe's own period list — same rows
  // getAllPeriods would return, already loaded, ordered here by start year.
  const civOptions = useMemo(
    () => [...periods].sort((a, b) => a.start_year - b.start_year),
    [periods],
  );

  // Interaction state lives in refs; paints happen outside React renders.
  const st = useRef({
    rotation: (initialRotation ?? [-70, -25]) as [number, number],
    zoom: 1,
    size: 640,
    year: initialYear,
    modern: initialModern,
    showLinks: initialLinks,
    view: initialView,
    people: [] as GlobePerson[],
    palette: null as GlobePalette | null,
    heartlands: [] as DrawResult["heartlands"],
    stars: [] as DrawResult["stars"],
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  st.current.people = filtered;

  // Keep the ref in sync with scrubber state, repaint on change.
  useEffect(() => {
    st.current.year = year;
    paint();
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current.modern = modern;
    paint();
  }, [modern]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current.showLinks = showLinks;
    paint();
  }, [showLinks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current.view = view;
    paint();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    paint();
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- shareable year ------------------------------------------------------
  // Mirror the scrubbed year into the URL so a view can be shared: once a
  // scrub (or a pause) settles for 400ms, replace ?year= — built from the
  // CURRENT location.search so every other param (view/lens/modern/links/
  // genre/civ, and a ?focus= entry hint) rides along untouched. NEVER during
  // play: a rAF loop would spam router.replace every frame; pausing writes
  // the year you stopped at (the effect re-fires on the playing flip).
  // Rotation drag deliberately writes NOTHING — ?focus= is an entry hint,
  // not tracked state, so spinning the globe never touches the URL.
  const yearWriteArmed = useRef(false);
  useEffect(() => {
    if (playing) return;
    if (!yearWriteArmed.current) {
      // Skip the mount pass — a bare /world visit shouldn't grow a ?year=.
      yearWriteArmed.current = true;
      return;
    }
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set("year", String(Math.round(year)));
      router.replace(`/world?${params.toString()}`, { scroll: false });
    }, 400);
    return () => window.clearTimeout(id);
  }, [year, playing, router]);

  /** Mirror view/facet/overlay state into the URL (shareable, composes with
   *  ?lens=) without a navigation — the repaint already happened from state. */
  function syncUrl(next: {
    modern?: boolean;
    links?: boolean;
    view?: GlobeView;
    genres?: string[];
    civ?: string | null;
  }) {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    set("modern", (next.modern ?? modern) ? "1" : null);
    // Connections default ON: the param only appears to turn them OFF.
    set("links", (next.links ?? showLinks) ? null : "0");
    const v = next.view ?? view;
    set("view", v === "periods" ? null : v);
    const g = next.genres ?? genres;
    set("genre", g.length ? g.join(",") : null);
    set("civ", next.civ !== undefined ? next.civ : civ);
    const q = params.toString();
    router.replace(q ? `/world?${q}` : "/world", { scroll: false });
  }

  function toggleModern(next: boolean) {
    setModern(next);
    syncUrl({ modern: next });
  }

  function toggleLinks(next: boolean) {
    setShowLinks(next);
    syncUrl({ links: next });
  }

  function switchView(next: GlobeView) {
    setView(next);
    syncUrl({ view: next });
  }

  function toggleGenre(genre: string) {
    const next = genres.includes(genre)
      ? genres.filter((g) => g !== genre)
      : [...genres, genre];
    setGenres(next);
    syncUrl({ genres: next });
  }

  function switchCiv(next: string | null) {
    setCiv(next);
    syncUrl({ civ: next });
  }

  function paint() {
    const canvas = canvasRef.current;
    const s = st.current;
    if (!canvas || !s.palette) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== s.size * dpr) {
      canvas.width = s.size * dpr;
      canvas.height = s.size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const res = drawGlobe(
      ctx,
      {
        width: s.size,
        height: s.size,
        rotation: s.rotation,
        zoom: s.zoom,
        year: s.year,
        periods,
        events,
        view: s.view,
        people: s.people,
        links,
        showConnections: s.showLinks,
        land,
        lensPeriodIds: lensP,
        lensEventIds: lensE,
        lensPersonIds: lensPer,
        modern: { enabled: s.modern, borders: countryBorders, labels: countryLabels },
      },
      s.palette,
    );
    s.heartlands = res.heartlands;
    s.stars = res.stars;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const s = st.current;
    s.palette = readPalette();

    const ro = new ResizeObserver(() => {
      s.size = Math.min(wrap.clientWidth, 760);
      paint();
    });
    ro.observe(wrap);
    s.size = Math.min(wrap.clientWidth, 760);

    // Stars sit on top of heartlands in the paint order, so hit-test them first.
    const hitAt = (mx: number, my: number) =>
      s.stars.find((h) => Math.hypot(h.x - mx, h.y - my) < 10) ??
      s.heartlands.find((h) => Math.hypot(h.x - mx, h.y - my) < 10);
    const isStar = (id: string) => s.stars.some((h) => h.id === id);

    // --- drag to rotate (URL-silent: ?focus= is an entry hint, so spinning
    // the globe never writes — unlike the scrubbed year above) -------------
    function down(ev: PointerEvent) {
      s.dragging = true;
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      canvas!.setPointerCapture(ev.pointerId);
    }
    function move(ev: PointerEvent) {
      if (!s.dragging) {
        // hover: heartland/star hit for cursor affordance
        const rect = canvas!.getBoundingClientRect();
        const hit = hitAt(ev.clientX - rect.left, ev.clientY - rect.top);
        canvas!.style.cursor = hit ? "pointer" : "grab";
        return;
      }
      const k = 0.22 / s.zoom;
      s.rotation = [
        s.rotation[0] + (ev.clientX - s.lastX) * k,
        Math.max(-MAX_PHI, Math.min(MAX_PHI, s.rotation[1] - (ev.clientY - s.lastY) * k)),
      ];
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      paint();
    }
    function up() {
      s.dragging = false;
    }
    function wheel(ev: WheelEvent) {
      ev.preventDefault();
      s.zoom = Math.max(0.8, Math.min(2.6, s.zoom * (ev.deltaY < 0 ? 1.08 : 0.92)));
      paint();
    }
    function click(ev: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const hit = hitAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (hit) router.push(isStar(hit.id) ? `/people/${hit.id}` : `/periods/${hit.id}`);
    }

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("click", click);
    paint();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("click", click);
    };
  }, [periods, events, router, lensP, lensE, lensPer]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- play mode ---------------------------------------------------------
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setYear((y) => {
        const next = y + dt * PLAY_YEARS_PER_SEC;
        if (next >= maxYear) {
          setPlaying(false);
          return maxYear;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxYear]);

  const displayYear = Math.round(year);
  const active = useMemo(
    () => periods.filter((p) => activeAt(p, displayYear)),
    [periods, displayYear],
  );
  const flaring = useMemo(
    () => visibleEvents(events, displayYear).sort((a, b) => b.intensity - a.intensity),
    [events, displayYear],
  );
  const shining = useMemo(
    () =>
      filtered
        .filter((p) => personAliveAt(p, displayYear))
        .sort((a, b) => a.importance - b.importance || a.birth_year - b.birth_year),
    [filtered, displayYear],
  );

  // Lens sets in the shape linkLensAlpha wants (undefined = no lens active).
  const linkLens = useMemo(
    () =>
      lensP || lensE || lensPer
        ? { periodIds: lensP, personIds: lensPer, eventIds: lensE }
        : undefined,
    [lensP, lensE, lensPer],
  );

  // Connections active at T. Journey hops sharing a group_id collapse to one
  // entry — the hop most alive at the scrubbed year represents the journey.
  const activeLinks = useMemo(() => {
    if (!showLinks) return [];
    const singles: ResolvedLink[] = [];
    const groups = new Map<string, ResolvedLink[]>();
    for (const rl of links) {
      if (linkAlpha(rl.link, displayYear) <= 0) continue;
      if (rl.link.group_id) {
        const g = groups.get(rl.link.group_id);
        if (g) g.push(rl);
        else groups.set(rl.link.group_id, [rl]);
      } else {
        singles.push(rl);
      }
    }
    const collapsed = [...groups.values()].map((hops) =>
      hops.reduce((best, h) =>
        linkAlpha(h.link, displayYear) > linkAlpha(best.link, displayYear) ? h : best,
      ),
    );
    return [...singles, ...collapsed].sort(
      (x, y) =>
        x.link.importance - y.link.importance ||
        x.link.start_year - y.link.start_year,
    );
  }, [links, showLinks, displayYear]);

  const showPeople = view !== "periods";
  const pill = (selected: boolean) =>
    `px-3 py-1 text-sm border ${
      selected
        ? "bg-(--color-ink) text-(--color-vellum) border-(--color-ink)"
        : "border-(--color-rule) hover:border-(--color-ink)"
    }`;

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
      <div ref={wrapRef}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="eyebrow mr-1">view</span>
          {(Object.keys(VIEW_LABEL) as GlobeView[]).map((v) => (
            <button key={v} className={pill(view === v)} onClick={() => switchView(v)}>
              {VIEW_LABEL[v]}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={showLinks}
              onChange={(e) => toggleLinks(e.target.checked)}
              className="accent-(--color-ink)"
            />
            Connections
          </label>
        </div>
        {showPeople && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="eyebrow mr-1">genre</span>
            {availableGenres.map((g) => (
              <button key={g} className={pill(genres.includes(g))} onClick={() => toggleGenre(g)}>
                {g}
              </button>
            ))}
            <select
              value={civ ?? ""}
              onChange={(e) => switchCiv(e.target.value || null)}
              className="border border-(--color-rule) bg-(--color-vellum) px-2 py-1 text-sm"
              aria-label="Civilization"
            >
              <option value="">All civilizations</option>
              {civOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-sm text-(--color-ink-soft)">
              {filtered.length} of {people.length} people
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: "100%", maxWidth: 760, aspectRatio: "1", touchAction: "none" }}
          role="img"
          aria-label={`Globe showing ${
            showPeople ? "people and civilizations" : "civilizations"
          } active in ${formatYear(displayYear)}. The same information is listed as text beside the globe.`}
        />
        <div className="flex items-center gap-4 mt-4 max-w-[760px]">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="border border-(--color-ink) px-4 py-1.5 text-sm hover:bg-(--color-vellum-deep)"
          >
            {playing ? "Pause" : "Play history"}
          </button>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={displayYear}
            onChange={(e) => {
              setPlaying(false);
              setYear(Number(e.target.value));
            }}
            className="flex-1 accent-(--color-ink)"
            aria-label="Year"
          />
          <span className="year text-base w-40 text-right">
            {formatYearDual(displayYear)}
          </span>
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={modern}
              onChange={(e) => toggleModern(e.target.checked)}
              className="accent-(--color-ink)"
            />
            Modern borders
          </label>
        </div>
        <p className="eyebrow mt-3">
          drag to spin · scroll to zoom · click a heartland or star to open it
        </p>
      </div>

      <aside className="border-l-2 border-(--color-rule) pl-5 space-y-6">
        {/* Bridge to the timeline. Carries the lens across; NOT the year —
            the timeline has no year-viewport param yet (open decision in
            docs/features.md: "timeline ?window= viewport deep-link"). */}
        <p>
          <Link
            href={activeLens ? `/timeline?lens=${activeLens}` : "/timeline"}
            className="eyebrow hover:underline"
          >
            this year on the timeline →
          </Link>
        </p>
        {showPeople && (
          <div>
            <p className="eyebrow mb-2">Shining in {formatYear(displayYear)}</p>
            {shining.length === 0 ? (
              <p className="text-sm text-(--color-ink-soft)">
                No one matching in this year.
              </p>
            ) : (
              <ul className="space-y-2">
                {shining.map((p) => {
                  const ghosted = lensPer && !lensPer.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex items-baseline gap-2.5 text-sm ${ghosted ? "opacity-40" : ""}`}
                    >
                      <RegionTick region={p.region as Region} />
                      <span>
                        <Link href={`/people/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                        {p.place && (
                          <span className="block text-xs text-(--color-ink-soft)">
                            {p.place}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div>
          <p className="eyebrow mb-2">Alive in {formatYear(displayYear)}</p>
          {active.length === 0 ? (
            <p className="text-sm text-(--color-ink-soft)">
              Nothing in the atlas yet for this year.
            </p>
          ) : (
            <ul className="space-y-2">
              {active.map((p) => {
                const ghosted = lensP && !lensP.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex items-baseline gap-2.5 text-sm ${ghosted ? "opacity-40" : ""}`}
                  >
                    <RegionTick region={p.region as Region} />
                    <Link href={`/periods/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {activeLinks.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Connections</p>
            <ul className="space-y-2">
              {activeLinks.map((rl) => {
                const l = rl.link;
                const ghosted = linkLens && linkLensAlpha(l, linkLens) < 1;
                return (
                  <li
                    key={l.group_id ?? l.id}
                    className={`flex items-baseline gap-2.5 text-sm ${ghosted ? "opacity-40" : ""}`}
                  >
                    <span className="year" title={l.kind}>
                      {KIND_GLYPH[l.kind]}
                    </span>
                    <span>
                      {/* A collapsed journey shows the ACTIVE hop's endpoints;
                          single links lead with their summary's first clause. */}
                      {l.group_id
                        ? `${rl.a.label} ↔ ${rl.b.label}`
                        : firstClause(l.summary)}
                      <span className="year block">
                        {l.end_year === null
                          ? formatYear(l.start_year)
                          : `${formatYear(l.start_year)}–${formatYear(l.end_year)}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {flaring.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Flaring</p>
            <ul className="space-y-2">
              {flaring.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.name}
                  <span className="year block">{formatYear(e.start_year)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
