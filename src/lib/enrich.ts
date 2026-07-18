/**
 * Wikidata enrichment — PURE parsing layer. No network here; scripts/enrich.ts
 * owns fetching. We use the EntityData JSON endpoint rather than SPARQL:
 *   https://www.wikidata.org/wiki/Special:EntityData/{QID}.json
 * — plain JSON, no query service quirks, trivially cacheable.
 *
 * The payload is written to the `enrichment` JSONB column and NEVER overrides
 * curated fields at render time (README invariant 2). `label` is stored so a
 * QID typo is visible: if label != our curated name, a human should look.
 */

export interface EnrichmentPayload {
  qid: string;
  /** Wikidata's English label — compare against curated name to catch QID typos. */
  label: string | null;
  description: string | null;
  /** Commons image filename (P18), if any. */
  imageFile: string | null;
  /** English Wikipedia article title, if any. */
  enwiki: string | null;
  fetchedAt: string; // ISO timestamp
}

/** Minimal shape of the EntityData response we consume. */
interface WikidataEntityJson {
  entities: Record<
    string,
    {
      labels?: Record<string, { value: string }>;
      descriptions?: Record<string, { value: string }>;
      claims?: Record<
        string,
        Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>
      >;
      sitelinks?: Record<string, { title: string }>;
    }
  >;
}

export function parseEntity(
  qid: string,
  json: unknown,
  now: () => Date = () => new Date(),
): EnrichmentPayload {
  const data = json as WikidataEntityJson;
  // Redirected QIDs come back keyed by their target — take whatever entity
  // is present rather than requiring an exact key match.
  const entity = data.entities?.[qid] ?? Object.values(data.entities ?? {})[0];
  if (!entity) {
    throw new Error(`No entity in EntityData response for ${qid}`);
  }

  const p18 = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

  return {
    qid,
    label: entity.labels?.en?.value ?? null,
    description: entity.descriptions?.en?.value ?? null,
    imageFile: typeof p18 === "string" ? p18 : null,
    enwiki: entity.sitelinks?.enwiki?.title ?? null,
    fetchedAt: now().toISOString(),
  };
}

/**
 * Commons image URL via Special:FilePath (server-side redirect to the file;
 * `width` gives a thumbnail). No API call needed.
 */
export function commonsImageUrl(imageFile: string, width = 640): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    imageFile,
  )}?width=${width}`;
}

export function entityDataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
}

/** QID label mismatch = probable typo in the spine. */
export function labelLooksWrong(curatedName: string, payload: EnrichmentPayload): boolean {
  if (!payload.label) return false;
  const a = curatedName.toLowerCase();
  const b = payload.label.toLowerCase();
  return !a.includes(b) && !b.includes(a);
}
