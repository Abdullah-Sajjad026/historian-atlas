-- Custom migration: generated range columns + GiST indexes.
-- These are outside Drizzle's DSL — this file is the raw-SQL escape hatch.
--
-- Semantics:
--   * '[]' inclusive bounds on both ends.
--   * COALESCE(end_year, 3000) — 3000 is the ONGOING sentinel (src/lib/dates.ts).
--   * Point events collapse to [start_year, start_year].
--
-- drizzle-kit generated the range columns as PLAIN int4range in 0000 (it can't
-- express GENERATED). Drop and re-add as generated — safe because generated
-- columns carry no independent data.

ALTER TABLE periods DROP COLUMN IF EXISTS year_range;
ALTER TABLE people  DROP COLUMN IF EXISTS life_range;
ALTER TABLE events  DROP COLUMN IF EXISTS year_range;

ALTER TABLE periods
  ADD COLUMN year_range int4range
  GENERATED ALWAYS AS (int4range(start_year, COALESCE(end_year, 3000), '[]')) STORED;

ALTER TABLE people
  ADD COLUMN life_range int4range
  GENERATED ALWAYS AS (
    int4range(COALESCE(birth_year, -10000), COALESCE(death_year, 3000), '[]')
  ) STORED;

ALTER TABLE events
  ADD COLUMN year_range int4range
  GENERATED ALWAYS AS (int4range(start_year, COALESCE(end_year, start_year), '[]')) STORED;

-- The indexes that make time-slice queries O(log n):
CREATE INDEX IF NOT EXISTS periods_slice_idx ON periods USING GIST (year_range);
CREATE INDEX IF NOT EXISTS people_slice_idx  ON people  USING GIST (life_range);
CREATE INDEX IF NOT EXISTS events_slice_idx  ON events  USING GIST (year_range);

-- Succession chain FK (deferred to here because 0000 orders tables alphabetically
-- and self-referencing FKs via Drizzle's DSL caused a type-inference cycle).
ALTER TABLE periods
  ADD CONSTRAINT periods_parent_fk FOREIGN KEY (parent_id) REFERENCES periods(id);
