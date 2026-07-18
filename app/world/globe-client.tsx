"use client";

/**
 * Interactive globe. All painting is src/lib/globe-draw.ts (shared with the
 * preview script); this component owns only interaction state: rotation drag,
 * wheel zoom, the year scrubber, play mode, and heartland click-through.
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
  type GlobePeriod,
  type GlobeEvent,
} from "@/lib/globe";
import { drawGlobe, type GlobePalette, type DrawResult } from "@/lib/globe-draw";
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

interface Props {
  periods: GlobePeriod[];
  events: GlobeEvent[];
  minYear: number;
  maxYear: number;
  lensPeriodIds: string[] | null;
  lensEventIds: string[] | null;
  /** Initial state of the modern-borders overlay (?modern=1). */
  initialModern: boolean;
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
  minYear,
  maxYear,
  lensPeriodIds,
  lensEventIds,
  initialModern,
}: Props) {
  const lensP = useMemo(
    () => (lensPeriodIds ? new Set(lensPeriodIds) : undefined),
    [lensPeriodIds],
  );
  const lensE = useMemo(
    () => (lensEventIds ? new Set(lensEventIds) : undefined),
    [lensEventIds],
  );
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(751);
  const [playing, setPlaying] = useState(false);
  const [modern, setModern] = useState(initialModern);

  // Interaction state lives in refs; paints happen outside React renders.
  const st = useRef({
    rotation: [-70, -25] as [number, number],
    zoom: 1,
    size: 640,
    year: 751,
    modern: initialModern,
    palette: null as GlobePalette | null,
    heartlands: [] as DrawResult["heartlands"],
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Keep the ref in sync with scrubber state, repaint on change.
  useEffect(() => {
    st.current.year = year;
    paint();
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current.modern = modern;
    paint();
  }, [modern]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Toggle the overlay and mirror it into the URL (shareable, composes with
   *  ?lens=) without a navigation — the repaint already happened from state. */
  function toggleModern(next: boolean) {
    setModern(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("modern", "1");
    else params.delete("modern");
    const q = params.toString();
    router.replace(q ? `/world?${q}` : "/world", { scroll: false });
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
        land,
        lensPeriodIds: lensP,
        lensEventIds: lensE,
        modern: { enabled: s.modern, borders: countryBorders, labels: countryLabels },
      },
      s.palette,
    );
    s.heartlands = res.heartlands;
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

    // --- drag to rotate --------------------------------------------------
    function down(ev: PointerEvent) {
      s.dragging = true;
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      canvas!.setPointerCapture(ev.pointerId);
    }
    function move(ev: PointerEvent) {
      if (!s.dragging) {
        // hover: heartland hit for cursor affordance
        const rect = canvas!.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const hit = s.heartlands.some((h) => Math.hypot(h.x - mx, h.y - my) < 10);
        canvas!.style.cursor = hit ? "pointer" : "grab";
        return;
      }
      const k = 0.22 / s.zoom;
      s.rotation = [
        s.rotation[0] + (ev.clientX - s.lastX) * k,
        Math.max(-80, Math.min(80, s.rotation[1] - (ev.clientY - s.lastY) * k)),
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
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const hit = s.heartlands.find((h) => Math.hypot(h.x - mx, h.y - my) < 10);
      if (hit) router.push(`/periods/${hit.id}`);
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
  }, [periods, events, router, lensP, lensE]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
      <div ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", maxWidth: 760, aspectRatio: "1", touchAction: "none" }}
          role="img"
          aria-label={`Globe showing civilizations active in ${formatYear(displayYear)}. The same information is listed as text beside the globe.`}
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
          drag to spin · scroll to zoom · click a heartland to open it
        </p>
      </div>

      <aside className="border-l-2 border-(--color-rule) pl-5 space-y-6">
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
