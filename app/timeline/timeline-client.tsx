"use client";

/**
 * Canvas timeline renderer. Thin by design: all geometry/LOD/hit-testing
 * lives in src/lib/timeline-layout.ts (pure + tested); this component only
 * owns the DOM concerns — zoom transform, devicePixelRatio, pointer events,
 * tooltip, and the actual paint calls.
 *
 * Hit targets: rather than a parallel SVG overlay, we hit-test the pointer
 * against the same layout boxes the canvas painted. One geometry source,
 * nothing to keep in sync.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import type { PeriodRow, EventRow } from "@/db/queries";
import type { Region } from "@/db/schema";
import {
  buildLanes,
  layoutTimeline,
  hitTest,
  type TimelineLayout,
  type TimelinePerson,
} from "@/lib/timeline-layout";
import { drawTimeline, type TimelinePalette } from "@/lib/timeline-draw";
import { formatYear } from "@/lib/dates";
import { REGION_LABEL } from "../components";

interface Props {
  periods: PeriodRow[];
  events: EventRow[];
  people: TimelinePerson[];
  lensPeriodIds: string[] | null;
  lensEventIds: string[] | null;
}

interface Tooltip {
  x: number;
  y: number;
  title: string;
  detail: string;
}

/** Read the pigment tokens once so canvas + CSS share one source of truth. */
function readPigments(): Record<Region, string> & { ink: string; soft: string; rule: string } {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    "east-asia": v("--color-east-asia"),
    "south-asia": v("--color-south-asia"),
    mena: v("--color-mena"),
    europe: v("--color-europe"),
    "sub-saharan-africa": v("--color-sub-saharan-africa"),
    americas: v("--color-americas"),
    "steppe-central-asia": v("--color-steppe-central-asia"),
    ink: v("--color-ink"),
    soft: v("--color-ink-soft"),
    rule: v("--color-rule"),
  };
}

const GHOST = 0.15;

export default function TimelineClient({
  periods,
  events,
  people,
  lensPeriodIds,
  lensEventIds,
}: Props) {
  const lensP = useMemo(
    () => (lensPeriodIds ? new Set(lensPeriodIds) : null),
    [lensPeriodIds],
  );
  const lensE = useMemo(
    () => (lensEventIds ? new Set(lensEventIds) : null),
    [lensEventIds],
  );
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [height, setHeight] = useState(320);

  const lanes = useMemo(() => buildLanes(periods), [periods]);

  // Domain: data extent padded 6% each side.
  const domain = useMemo<[number, number]>(() => {
    const starts = periods.map((p) => p.start_year);
    const ends = periods.map((p) => p.end_year ?? p.start_year + 50);
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const pad = Math.max(20, Math.round((max - min) * 0.06));
    return [min - pad, max + pad];
  }, [periods]);

  // Mutable render state kept in refs — redraws happen outside React.
  const stateRef = useRef<{
    transform: ZoomTransform;
    baseX: ScaleLinear<number, number> | null;
    layout: TimelineLayout | null;
    pigments: ReturnType<typeof readPigments> | null;
    width: number;
  }>({ transform: zoomIdentity, baseX: null, layout: null, pigments: null, width: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const st = stateRef.current;
    st.pigments = readPigments();

    function draw() {
      if (!canvas || !st.baseX || !st.pigments) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const x = st.transform.rescaleX(st.baseX);
      const [d0, d1] = x.domain() as [number, number];
      const pxPerYear = st.width / (d1 - d0);
      const layout = layoutTimeline(lanes, events, (yr) => x(yr), pxPerYear, people);
      st.layout = layout;

      const h = Math.max(layout.totalHeight + 8, 200);
      setHeight(h); // grows/shrinks with LOD row count

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== st.width * dpr || canvas.height !== h * dpr) {
        canvas.width = st.width * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const P = st.pigments;
      const palette: TimelinePalette = {
        ink: P.ink,
        soft: P.soft,
        rule: P.rule,
        barText: "#F5F0E4",
        pigment: (r) => P[r as keyof typeof P] as string,
        laneLabel: (r) => REGION_LABEL[r as keyof typeof REGION_LABEL].toUpperCase(),
      };
      drawTimeline(
        ctx,
        {
          width: st.width,
          height: h,
          ticks: x.ticks(Math.max(3, Math.floor(st.width / 110))),
          xOf: (yr) => x(yr),
          layout,
          lensPeriodIds: lensP,
          lensEventIds: lensE,
        },
        palette,
      );
    }

    // --- sizing ------------------------------------------------------------
    const ro = new ResizeObserver(() => {
      st.width = wrap.clientWidth;
      if (st.baseX) st.baseX.range([0, st.width]);
      draw();
    });
    st.width = wrap.clientWidth;
    st.baseX = scaleLinear().domain(domain).range([0, st.width]);
    ro.observe(wrap);

    // --- zoom ----------------------------------------------------------
    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.8, 300])
      .translateExtent([
        [st.baseX(domain[0]) - 200, 0],
        [st.baseX(domain[1]) + 200, 0],
      ])
      .on("zoom", (ev) => {
        st.transform = ev.transform;
        setTooltip(null);
        draw();
      });
    const sel = select(canvas);
    sel.call(zoomBehavior);

    // --- pointer: hover tooltip + click navigation ----------------------
    function onMove(ev: PointerEvent) {
      if (!st.layout) return;
      const rect = canvas!.getBoundingClientRect();
      const hit = hitTest(st.layout, ev.clientX - rect.left, ev.clientY - rect.top);
      canvas!.style.cursor = hit ? "pointer" : "grab";
      if (!hit) return setTooltip(null);
      setTooltip({
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        title: hit.name,
        detail:
          hit.kind === "period"
            ? `${formatYear(hit.startYear)} – ${hit.endYear ? formatYear(hit.endYear) : "present"}`
            : hit.kind === "person"
              ? `${formatYear(hit.birthYear)} – ${hit.deathYear ? formatYear(hit.deathYear) : ""}`
              : formatYear(hit.year),
      });
    }
    function onClick(ev: MouseEvent) {
      if (!st.layout) return;
      const rect = canvas!.getBoundingClientRect();
      const hit = hitTest(st.layout, ev.clientX - rect.left, ev.clientY - rect.top);
      if (hit?.kind === "period") router.push(`/periods/${hit.id}`);
      else if (hit?.kind === "person") router.push(`/people/${hit.id}`);
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointerleave", () => setTooltip(null));

    draw();

    return () => {
      ro.disconnect();
      sel.on(".zoom", null);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [lanes, events, people, domain, router, lensP, lensE]);

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        role="img"
        aria-label="Zoomable parallel timeline of civilizations by region. The same periods are listed as text on the home page."
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-(--color-ink) text-(--color-vellum) text-sm px-3 py-1.5 rounded-sm shadow"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14, maxWidth: 260 }}
        >
          <span className="font-(family-name:--font-display)">{tooltip.title}</span>
          <span className="block year !text-(--color-vellum-deep)">
            {tooltip.detail}
          </span>
        </div>
      )}
      <p className="eyebrow mt-3">
        scroll or pinch to zoom · drag to pan · click a bar to open it
      </p>
    </div>
  );
}
