/**
 * Timeline paint — ONE draw function shared verbatim by the browser client
 * and scripts/render-preview.ts (same pattern as globe-draw.ts). Includes:
 *   - draw culling (isBoxVisible) — off-viewport boxes cost nothing
 *   - viewport-clamped inside labels (long bars keep their name on screen)
 *   - collision-aware outside labels (labelSpace from the layout — a label
 *     beside a short bar is skipped rather than overprinting the next bar;
 *     the tooltip still reveals the name)
 *   - lens ghosting (alpha only)
 */

import {
  METRICS,
  isBoxVisible,
  type TimelineLayout,
} from "./timeline-layout";
import { formatYear } from "./dates";
import { withAlpha } from "./globe-draw";

export interface TimelinePalette {
  ink: string;
  soft: string;
  rule: string;
  barText: string; // label color inside bars
  pigment: (region: string) => string;
  laneLabel: (region: string) => string;
}

export interface TimelineFrame {
  width: number;
  height: number;
  ticks: number[]; // axis tick years (integer)
  xOf: (year: number) => number;
  layout: TimelineLayout;
  lensPeriodIds?: Set<string> | null;
  lensEventIds?: Set<string> | null;
  fonts?: { mono: string; label: string; person: string };
}

const GHOST = 0.15;
const DEFAULT_FONTS = {
  mono: "11px ui-monospace, Menlo, monospace",
  label: "13px 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  person: "10px ui-monospace, Menlo, monospace",
};

type Ctx = CanvasRenderingContext2D;

export function drawTimeline(ctx: Ctx, f: TimelineFrame, P: TimelinePalette): void {
  const fonts = f.fonts ?? DEFAULT_FONTS;
  ctx.clearRect(0, 0, f.width, f.height);

  // --- axis -----------------------------------------------------------
  ctx.font = fonts.mono;
  for (const t of f.ticks) {
    if (!Number.isInteger(t)) continue;
    const px = f.xOf(t);
    ctx.strokeStyle = P.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, METRICS.axisHeight - 8);
    ctx.lineTo(px, f.height);
    ctx.stroke();
    ctx.fillStyle = P.soft;
    ctx.fillText(formatYear(t), px + 4, METRICS.axisHeight - 12);
  }

  // --- lane labels ----------------------------------------------------
  for (const lane of f.layout.laneTops) {
    ctx.fillStyle = P.soft;
    ctx.font = fonts.mono;
    ctx.fillText(P.laneLabel(lane.region), 8, lane.top + 13);
  }

  // --- period bars ----------------------------------------------------
  for (const b of f.layout.boxes) {
    if (!isBoxVisible(b, f.width)) continue;
    ctx.globalAlpha = f.lensPeriodIds && !f.lensPeriodIds.has(b.id) ? GHOST : 1;
    ctx.fillStyle = P.pigment(b.region);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, METRICS.barRadius);
    ctx.fill();

    ctx.font = fonts.label;
    const tw = ctx.measureText(b.name).width;
    const visX = Math.max(b.x, 0);
    const visW = Math.min(b.x + b.w, f.width) - visX;
    if (tw + 16 <= visW) {
      // inside the bar, clamped to the viewport
      ctx.fillStyle = P.barText;
      ctx.fillText(b.name, visX + 8, b.y + b.h / 2 + 4.5);
    } else if (b.x + b.w < f.width && tw + 12 <= b.labelSpace) {
      // beside the bar, only when it fits before the next bar in the row
      ctx.fillStyle = P.ink;
      ctx.fillText(b.name, b.x + b.w + 6, b.y + b.h / 2 + 4.5);
    }
    ctx.globalAlpha = 1;
  }

  // --- person threads (only present at human-scale zoom) ---------------
  for (const p of f.layout.personBoxes) {
    if (!isBoxVisible(p, f.width)) continue;
    const pig = P.pigment(p.region);
    const barY = p.y + (p.h - METRICS.personBarHeight) / 2;
    ctx.fillStyle = withAlpha(pig, 0.55);
    ctx.beginPath();
    ctx.roundRect(p.x, barY, p.w, METRICS.personBarHeight, 2);
    ctx.fill();
    // birth tick (solid) — the thread starts somewhere definite
    ctx.fillStyle = pig;
    ctx.fillRect(p.x, p.y + 2, 2, p.h - 4);

    ctx.font = f.fonts?.person ?? DEFAULT_FONTS.person;
    const tw = ctx.measureText(p.name).width;
    if (p.x + p.w < f.width && tw + 10 <= p.labelSpace) {
      ctx.fillStyle = P.soft;
      ctx.fillText(p.name, p.x + p.w + 5, p.y + p.h / 2 + 3.5);
    } else if (tw + 12 <= Math.min(p.x + p.w, f.width) - Math.max(p.x, 0)) {
      ctx.fillStyle = P.ink;
      ctx.fillText(p.name, Math.max(p.x, 0) + 6, p.y + p.h / 2 + 3.5);
    }
  }

  // --- event lozenges -------------------------------------------------
  for (const e of f.layout.eventBoxes) {
    if (e.cx < -20 || e.cx > f.width + 20) continue;
    ctx.save();
    ctx.globalAlpha = f.lensEventIds && !f.lensEventIds.has(e.id) ? GHOST : 1;
    ctx.translate(e.cx, e.cy);
    ctx.rotate(Math.PI / 4);
    const s = METRICS.eventSize / Math.SQRT2;
    ctx.fillStyle = P.pigment(e.region);
    ctx.strokeStyle = P.barText;
    ctx.lineWidth = 1.5;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
}
