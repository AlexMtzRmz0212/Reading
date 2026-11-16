"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { NO_FILTERS, SORTS, facets, fromQuery, groupBooks, matches, searchKey, sortBooks, toQuery, type Filters, type Sort } from "@/lib/catalog";
import { normalize, plural } from "@/lib/format";
import { STATUSES, type Book, type PublicBook, type Status } from "@/lib/types";
import { BookSheet } from "./BookSheet";
import { DrawerTabs } from "./DrawerTabs";
import { IndexCard } from "./IndexCard";
import { OnLoanStrip } from "./OnLoanStrip";
import { useOwner } from "./useOwner";

// Visitors never download the owner’s tools.
const ProgressLogger = dynamic(() => import("./ProgressLogger").then((m) => m.ProgressLogger));

/** With the owner signed in the cards carry their Notion id, which is what the progress logger writes to. */
type CatalogBook = PublicBook & { id?: string };

const STATUS_LABEL: Record<Status, string> = { "Not started": "Awaiting", "In progress": "On loan", Done: "Finished" };

type Open = (slug: string, event: React.MouseEvent) => void;

const CardLink = memo(function CardLink({ book, onOpen, settle }: { book: CatalogBook; onOpen: Open; settle?: number }) {
  return (
    <li className={settle === undefined ? "[contain-intrinsic-size:auto_13rem] [content-visibility:auto]" : "settle"} style={settle === undefined ? undefined : ({ "--i": settle } as React.CSSProperties)}>
      <a href={`/book/${book.slug}`} className="card-button card-stretch h-full" onClick={(e) => onOpen(book.slug, e)}>
        <IndexCard book={book} />
      </a>
    </li>
  );
});

/** The open drawer: the strip of books on loan, the filters, the guide tabs and every card. */
export function CatalogView({ books }: { books: PublicBook[] }) {
  const owner = useOwner();
  const [mine, setMine] = useState<Book[] | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>("rank");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  // Cards settle into the drawer once, on arrival, not every time the filters change.
  const [arriving, setArriving] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setArriving(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Filters live in the address (?q=plato&sort=author): read once on arrival, then kept in step without adding
  // history entries. The page itself is static, so this happens after it loads.
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    const initial = fromQuery(window.location.search);
    if (Object.values(initial.filters).some(Boolean)) setFilters(initial.filters);
    setSort(initial.sort);
    setLinked(true);
  }, []);
  useEffect(() => {
    if (!linked) return;
    const query = toQuery(filters, sort);
    if (query !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${query}${window.location.hash}`);
  }, [linked, filters, sort]);

  // The owner’s copy of the catalog carries page ids and is always current.
  useEffect(() => {
    if (!owner) return;
    let live = true;
    fetch("/api/books", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { books?: Book[] } | null) => {
        if (live && d?.books) setMine(d.books);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [owner]);

  const all: CatalogBook[] = mine ?? books;
  const keys = useMemo(() => new Map(all.map((b) => [b.slug, searchKey(b)])), [all]);
  const menus = useMemo(() => facets(all), [all]);
  const q = useDeferredValue(normalize(filters.q));

  const groups = useMemo(() => {
    const shown = all.filter((b) => matches(b, keys.get(b.slug) ?? "", filters, q));
    return groupBooks(sortBooks(shown, sort), sort);
  }, [all, keys, filters, q, sort]);
  const shownCount = groups.reduce((n, g) => n + g.books.length, 0);
  const onLoan = useMemo(() => sortBooks(all.filter((b) => b.status === "In progress"), "rank"), [all]);
  const finished = all.reduce((n, b) => n + (b.status === "Done" ? 1 : 0), 0);
  const filtering = filters !== NO_FILTERS && Object.values(filters).some(Boolean);

  const open = useCallback<Open>((slug, e) => {
    // Ctrl/Cmd/middle click still opens the card’s own page in a new tab.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpenSlug(slug);
  }, []);
  const close = useCallback(() => setOpenSlug(null), []);
  const update = useCallback((book: Book) => setMine((list) => list?.map((b) => (b.id === book.id ? book : b)) ?? null), []);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const selected = openSlug ? all.find((b) => b.slug === openSlug) : undefined;
  let settled = 0;

  return (
    <>
      <header className="mb-8">
        <h1 className="page-title">Alex’s reading list</h1>
        <p className="mt-2 text-soft">
          {plural(all.length, "book")} in the drawer, filed by rank. {onLoan.length} on loan, {finished} finished.
        </p>
      </header>

      <OnLoanStrip books={onLoan} onOpen={open} />

      <section aria-labelledby="catalog">
        <h2 id="catalog" className="mb-3 font-serif text-2xl leading-tight font-bold">
          The catalog
        </h2>
        <form role="search" className="flex flex-wrap gap-3 [&>label]:min-w-[9.5rem] [&>label]:flex-1" onSubmit={(e) => e.preventDefault()}>
          <label className="basis-full! sm:flex-[2_1_16rem]!">
            <span className="label">Search</span>
            <input className="input" type="search" name="q" placeholder="Title or author…" autoComplete="off" spellCheck={false} value={filters.q} onChange={(e) => set("q", e.target.value)} />
          </label>
          <label>
            <span className="label">Author</span>
            <select className="input" value={filters.author} onChange={(e) => set("author", e.target.value)}>
              <option value="">All authors</option>
              {menus.authors.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Status</span>
            <select className="input" value={filters.status} onChange={(e) => set("status", e.target.value as Status | "")}>
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {menus.genres.length > 0 && (
            <label>
              <span className="label">Subject</span>
              <select className="input" value={filters.genre} onChange={(e) => set("genre", e.target.value)}>
                <option value="">All subjects</option>
                {menus.genres.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {menus.years.length > 0 && (
            <label>
              <span className="label">Year</span>
              <select className="input" value={filters.year} onChange={(e) => set("year", e.target.value)}>
                <option value="">Any year</option>
                {menus.years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="label">Sort by</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-4">
          <p role="status" aria-live="polite" className="text-[13px] text-soft tabular-nums">
            {filtering ? `${shownCount} of ${plural(all.length, "card")}` : plural(all.length, "card")}
          </p>
          {filtering && (
            <button type="button" className="btn btn-quiet px-0 text-[13px]" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>

        <DrawerTabs tabs={groups} />

        {shownCount === 0 ? (
          <p className="mt-6 max-w-md rounded-[3px] border border-dashed border-soft/50 p-6 text-soft">No card matches. Try fewer words, or clear the filters to see the whole drawer.</p>
        ) : (
          groups.map((g) => (
            <section key={g.id} id={g.id} aria-label={g.label} className="scroll-mt-16 pt-6">
              <div className="guide-card mb-4">
                <h3 className="guide-tab">{g.label}</h3>
                <span className="pb-1 text-[13px] text-soft tabular-nums">{plural(g.books.length, "card")}</span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.books.map((b) => (
                  <CardLink key={b.slug} book={b} onOpen={open} settle={arriving && settled < 12 ? settled++ : undefined} />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {selected && (
        <BookSheet key={selected.slug} book={selected} onClose={close}>
          {selected.id ? <ProgressLogger book={selected as Book} onChange={update} /> : null}
        </BookSheet>
      )}
    </>
  );
}
