import { describe, it, expect } from "vitest";
import {
  parseEntity,
  commonsImageUrl,
  entityDataUrl,
  labelLooksWrong,
} from "./enrich";

/** Hand-built fixture mirroring the EntityData shape for Q12536 (Abbasid). */
const fixture = {
  entities: {
    Q12536: {
      labels: { en: { value: "Abbasid Caliphate" } },
      descriptions: {
        en: { value: "third Islamic caliphate (750–1258, 1261–1517)" },
      },
      claims: {
        P18: [
          {
            mainsnak: {
              datavalue: { value: "Abbasid Caliphate 850AD.png" },
            },
          },
        ],
      },
      sitelinks: { enwiki: { title: "Abbasid Caliphate" } },
    },
  },
};

describe("parseEntity", () => {
  const now = () => new Date("2026-07-12T00:00:00Z");

  it("extracts label, description, image, and enwiki title", () => {
    const p = parseEntity("Q12536", fixture, now);
    expect(p.label).toBe("Abbasid Caliphate");
    expect(p.description).toContain("third Islamic caliphate");
    expect(p.imageFile).toBe("Abbasid Caliphate 850AD.png");
    expect(p.enwiki).toBe("Abbasid Caliphate");
    expect(p.fetchedAt).toBe("2026-07-12T00:00:00.000Z");
  });

  it("tolerates missing optional fields", () => {
    const p = parseEntity("Q1", { entities: { Q1: {} } }, now);
    expect(p.label).toBeNull();
    expect(p.imageFile).toBeNull();
  });

  it("follows QID redirects (entity keyed under target QID)", () => {
    const redirected = { entities: { Q99: { labels: { en: { value: "X" } } } } };
    expect(parseEntity("Q1", redirected, now).label).toBe("X");
  });

  it("throws on an empty response", () => {
    expect(() => parseEntity("Q1", { entities: {} }, now)).toThrow();
  });
});

describe("URL builders", () => {
  it("builds the EntityData URL", () => {
    expect(entityDataUrl("Q12536")).toBe(
      "https://www.wikidata.org/wiki/Special:EntityData/Q12536.json",
    );
  });
  it("encodes Commons filenames", () => {
    expect(commonsImageUrl("Abbasid Caliphate 850AD.png", 320)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Abbasid%20Caliphate%20850AD.png?width=320",
    );
  });
});

describe("labelLooksWrong (QID typo detector)", () => {
  const base = { qid: "Q1", description: null, imageFile: null, enwiki: null, fetchedAt: "" };
  it("passes when names substring-match either way", () => {
    expect(labelLooksWrong("Tang Dynasty", { ...base, label: "Tang dynasty" })).toBe(false);
    expect(labelLooksWrong("Abbasid Caliphate", { ...base, label: "Abbasid Caliphate" })).toBe(false);
  });
  it("flags a clear mismatch", () => {
    expect(labelLooksWrong("Ghana Empire", { ...base, label: "Republic of Ghana" })).toBe(true);
  });
  it("stays quiet when Wikidata has no English label", () => {
    expect(labelLooksWrong("Ghana Empire", { ...base, label: null })).toBe(false);
  });
});
