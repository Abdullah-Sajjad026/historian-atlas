import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSearchIndex } from "@/db/queries";
import { SearchBox } from "./search-box";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "historian — an atlas of parallel history",
  description:
    "Dynasties, empires, and the people who shaped them — and what was happening everywhere else at the same moment.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchIndex = await getSearchIndex();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b-2 border-(--color-ink) mx-6 md:mx-12 pt-8 pb-3 flex items-baseline gap-6">
          <Link
            href="/"
            className="font-(family-name:--font-display) text-2xl tracking-tight"
          >
            historian<span className="text-(--color-ink-soft)">.</span>
          </Link>
          <span className="eyebrow hidden sm:inline">
            an atlas of parallel history
          </span>
          <nav className="ml-auto flex items-baseline gap-5 text-sm">
            <SearchBox entries={searchIndex} />
            <Link href="/world" className="hover:underline">
              World
            </Link>
            <Link href="/timeline" className="hover:underline">
              Timeline
            </Link>
            <Link href="/" className="hover:underline">
              Civilizations
            </Link>
            <Link href="/themes/islamic-history" className="hover:underline">
              Islamic history
            </Link>
          </nav>
        </header>
        <main className="mx-6 md:mx-12 py-10 max-w-5xl">{children}</main>
        <footer className="mx-6 md:mx-12 py-8 border-t border-(--color-rule) eyebrow">
          curated spine · enriched from wikidata · years are approximate where
          marked
        </footer>
      </body>
    </html>
  );
}
