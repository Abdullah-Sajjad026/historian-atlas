"use client";

/**
 * Header search: client-side filter over the full entity index (small — the
 * spine is curated, not scraped; revisit if it ever exceeds a few thousand).
 * Arrow keys + Enter navigate; Escape closes.
 */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface SearchEntry {
  id: string;
  name: string;
  type: "period" | "person" | "event" | "theme";
  detail: string; // e.g. "750 – 1258 CE" or "caliphate"
}

const HREF: Record<SearchEntry["type"], (id: string) => string> = {
  period: (id) => `/periods/${id}`,
  person: (id) => `/people/${id}`,
  event: (id) => `/events/${id}`,
  theme: (id) => `/themes/${id}`,
};

export function SearchBox({ entries }: { entries: SearchEntry[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return entries
      .filter((e) => e.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, entries]);

  function go(entry: SearchEntry) {
    setQ("");
    setOpen(false);
    router.push(HREF[entry.type](entry.id));
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Search the atlas…"
        aria-label="Search periods, people, and events"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter" && results[cursor]) {
            e.preventDefault();
            go(results[cursor]);
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="w-44 md:w-56 bg-transparent border-b border-(--color-rule) focus:border-(--color-ink) outline-none text-sm py-1 placeholder:text-(--color-ink-soft)"
      />
      {open && results.length > 0 && (
        <ul
          className="absolute right-0 top-full mt-1 w-72 bg-(--color-vellum) border border-(--color-ink) shadow z-10"
          role="listbox"
        >
          {results.map((r, i) => (
            <li key={`${r.type}-${r.id}`} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-baseline gap-2 ${
                  i === cursor ? "bg-(--color-vellum-deep)" : ""
                }`}
              >
                <span>{r.name}</span>
                <span className="eyebrow ml-auto">{r.type}</span>
                <span className="year">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
