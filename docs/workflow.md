# Workflow — how this repo is developed and verified

## The core loop

1. Pure logic first: geometry/LOD/fade/lens/parse changes go in `src/lib/*`
   with vitest coverage (`npm test` — currently 78 tests).
2. Paint changes go in the SHARED draw modules (`timeline-draw.ts`,
   `globe-draw.ts`) — never in a component, never forked.
3. **Render previews and LOOK at them** (or audit them — below).
4. `npm run typecheck` + `npm test` + `npm run build`.
5. Content edits: `npm run seed` + refresh (no rebuild).

## The preview harness (the repo's superpower)

`scripts/render-preview.ts` (timeline) and `scripts/render-globe.ts`
(globe) execute the SHIPPED draw modules with node-canvas against LIVE DB
data and write PNGs to /tmp. Because the paint code is shared verbatim,
these PNGs are true visual regressions of production rendering — no
browser needed.

```bash
DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-preview.ts
DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-globe.ts
```

Edit the frame lists in those scripts to target the year/window/rotation
relevant to your change (e.g., a birth-fade change → render at
period.start_year + 4).

Track record — this loop caught, before any human saw the app:
- labels vanishing when a bar's left edge pans off-canvas (Phase 2)
- lens ghosting shrinking circles + ghost fills going invisible (Phase 5)
- (by its absence in Phase 2's mirrored-code era) the drift risk that
  motivated shared draw modules in the first place

## The audit pattern (when eyes aren't enough — or unavailable)

For deterministic verification, write a throwaway script that recomputes
the layout for the rendered window and asserts against it. Two proven
recipes:

**Decision audit** — replay the draw's branch logic with real text metrics
(node-canvas `measureText`) and print each element's outcome. Used to prove
label collision handling: Rashidun's 20px bar SKIPS its ~117px label at
0.7 px/yr and flips to "beside" at 2.4 px/yr.

**Pixel audit** — load the emitted PNG, sample pixels at layout-computed
positions, compare against the vellum background / expected pigment. Used
to prove: person threads painted (5/5 in-window, birth tick sampling pure
lapis rgb(43,91,142)) and lens ghosting visible-but-dimmed (ghosted-circle
pixel vs bare-land pixel deltas).

Keep audits as scratch scripts (they were deleted after use); resurrect the
pattern from this description rather than maintaining them.

## Prompt chains

Work sometimes arrives as a SEQUENCE of prompts, each building on the
last (foundation → patch → feature). Every prompt in a chain states its
prerequisites — treat them as a hard guard:

- Before writing anything, VERIFY each prerequisite actually exists in the
  repo (schema columns, functions, preview frames, session logs — check
  the artifacts, not just the git log message).
- If ANY prerequisite is missing: **halt and report** what's absent.
  Do NOT reconstruct missing prior work from what the current prompt
  implies about it — a reconstruction silently diverges from the real
  spec, and the next prompt in the chain will build on the divergence.
- A prerequisite check that passes is worth one line in the session log
  (what was verified, where); a check that fails is the session's entire
  output.

## Database workflow

- Schema change → edit `src/db/schema.ts` → `npm run db:generate` →
  inspect the emitted SQL → `npm run db:migrate`.
- Anything the DSL can't express (generated columns, GiST, self-FKs) →
  registered custom migration, EXACT procedure in docs/gotchas.md
  (the --custom flag blanks files; write SQL AFTER creating the slot).
- Verify the hot path stayed indexed after schema surgery:
  `EXPLAIN SELECT * FROM periods WHERE year_range @> 800;` must show
  `Index Scan using periods_slice_idx`.
- Seed is idempotent (upserts keyed on slug) — safe to run repeatedly; its
  final time-slice smoke query is a mini integration test.

## Server hygiene during manual testing

Rebuilds do NOT propagate to a running `next start` — kill it, confirm the
port is free (`ss -tlnp | grep <port>`), restart. In sandboxed shells,
background servers with `setsid ... &` so they outlive the command, and
run `pkill` as its own step (it can kill its own chain).

## Definition of done for a change

- [ ] Pure logic tested (new/updated vitest cases)
- [ ] `npm run typecheck` clean
- [ ] Visual change → preview PNGs rendered and inspected/audited
- [ ] `npm run build` clean (and remember: build must stay DB-free)
- [ ] Relevant doc updated (this docs/ set is part of the codebase —
      a change that invalidates architecture.md/gotchas.md without
      updating it is incomplete)
- [ ] Deliberately-open decisions in docs/features.md respected — if your
      change resolves one, record the resolution there
