"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { findDuplicates, matchOption } from "@/lib/dedupe";
import { formatRank } from "@/lib/ranks";
import { suggestGenres } from "@/lib/newBook";
import type { SearchResult } from "@/lib/providers/types";
import type { Choices } from "@/lib/types";
import { Spinner } from "./Bits";

export interface Known {
  slug: string;
  title: string;
  originalTitle?: string;
  author?: string;
  rank: number | null;
}

interface Draft {
  title: string;
  originalTitle: string;
  author: string;
  published: string;
  pages: string;
  coverUrl: string;
  genres: string[];
}
const EMPTY: Draft = { title: "", originalTitle: "", author: "", published: "", pages: "", coverUrl: "", genres: [] };

/** Owner screen: find a book on Open Library (or type it in), check it against the catalog, and file a new card. */
export function AddFromSearch({ known: initialKnown, choices }: { known: Known[]; choices: Choices }) {
  const [known, setKnown] = useState(initialKnown);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchNote, setSearchNote] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [anyway, setAnyway] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; slug?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const latest = useRef(0);

  const duplicates = useMemo(() => findDuplicates({ title: draft.title, originalTitle: draft.originalTitle, author: draft.author }, known), [draft.title, draft.originalTitle, draft.author, known]);
  const existingAuthor = draft.author.trim() ? matchOption(draft.author, choices.authors) : undefined;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMsg(null);
  };

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return setSearchNote("Type at least two letters to search.");
    const run = ++latest.current;
    setSearching(true);
    setSearchNote("");
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { results?: SearchResult[]; failed?: string[]; error?: string };
    if (run !== latest.current) return; // a newer search took over
    setSearching(false);
    if (!res?.ok) {
      setResults(null);
      return setSearchNote(data.error ?? "The search couldn’t be reached. You can still type the book in below.");
    }
    setResults(data.results ?? []);
    const failed = data.failed?.length ? `${data.failed.join(" and ")} didn’t answer. ` : "";
    setSearchNote(`${failed}${data.results?.length ? `${data.results.length} found. Choose one to fill in the card.` : "Nothing found. Try the original title, or type the book in below."}`);
  }

  function use(r: SearchResult) {
    const author = r.authors[0] ?? "";
    const genres = suggestGenres(r.subjects, choices.genres);
    setDraft({ title: r.title, originalTitle: r.title, author: matchOption(author, choices.authors) ?? author, published: r.year ?? "", pages: r.pages ? String(r.pages) : "", coverUrl: r.coverUrl ?? "", genres });
    setSuggested(genres);
    setAnyway(false);
    setMsg(null);
    formRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (duplicates.length > 0 && !anyway) return setMsg({ ok: false, text: "This looks like a book already in the catalog. Tick “Add it anyway” to file a second card." });
    setSaving(true);
    setMsg(null);
    const body = { ...draft, pages: draft.pages ? Number(draft.pages) : undefined, allowDuplicate: anyway };
    const res = await fetch("/api/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { slug?: string; title?: string; author?: string; error?: string };
    setSaving(false);
    if (!res?.ok || !data.slug) return setMsg({ ok: false, text: data.error ?? "Couldn’t reach the server. Nothing was added." });
    setKnown((list) => [...list, { slug: data.slug!, title: draft.title, originalTitle: draft.originalTitle || undefined, author: data.author, rank: null }]);
    setMsg({ ok: true, text: `Filed “${data.title}” in the Uncatalogued pile.`, slug: data.slug });
    setDraft(EMPTY);
    setSuggested([]);
    setAnyway(false);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="page-title mb-2">Add a book</h1>
      <p className="mb-8 max-w-[60ch] text-soft">Search Open Library to fill in the card, or type it yourself. New books start as Awaiting, with no rank.</p>

      <section aria-labelledby="add-search" className="mb-10">
        <h2 id="add-search" className="mb-3 font-serif text-2xl leading-tight font-bold">
          Find it
        </h2>
        <form role="search" onSubmit={search} className="flex max-w-xl items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="label">Title, author or ISBN</span>
            <input className="input" type="search" name="q" autoComplete="off" spellCheck={false} placeholder="Nineteen Eighty-Four…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="btn" disabled={searching}>
            {searching && <Spinner />}
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-soft">
          {searchNote}
        </p>
        {results && results.length > 0 && (
          <ul className="slip mt-2 divide-y divide-rule">
            {results.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="aspect-[2/3] w-10 shrink-0 bg-edge">
                  {r.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl.replace("-L.jpg", "-S.jpg")} alt="" width={40} height={60} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[19px] leading-snug">{r.title}</p>
                  <p className="truncate text-[13px] text-soft">{[r.authors.join(", "), r.year, r.pages && `${r.pages} p.`, r.source].filter(Boolean).join(", ")}</p>
                </div>
                <button type="button" className="btn" onClick={() => use(r)} aria-label={`Use ${r.title}`}>
                  Use
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-card">
        <h2 id="add-card" className="mb-3 font-serif text-2xl leading-tight font-bold">
          The card
        </h2>
        <form ref={formRef} onSubmit={save} className="slip grid gap-x-4 gap-y-4 border-t-[1.5px] border-t-red p-4 sm:grid-cols-2 sm:p-5">
          <label>
            <span className="label">Title, as you want it shown</span>
            <input className="input" name="title" required autoComplete="off" value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label>
            <span className="label">Original title</span>
            <input className="input" name="originalTitle" autoComplete="off" value={draft.originalTitle} onChange={(e) => set("originalTitle", e.target.value)} />
          </label>
          <label>
            <span className="label">Author</span>
            <input className="input" name="author" list="authors" autoComplete="off" value={draft.author} onChange={(e) => set("author", e.target.value)} aria-describedby="author-note" />
            <datalist id="authors">
              {choices.authors.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <span id="author-note" className="mt-1 block min-h-5 text-[13px] text-soft">
              {draft.author.trim() ? (existingAuthor ? `Files under the existing “${existingAuthor}”.` : "A new author in Notion.") : ""}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="label">Published</span>
              <input className="input tabular-nums" name="published" autoComplete="off" maxLength={10} placeholder="1949 or 1949-06-08" value={draft.published} onChange={(e) => set("published", e.target.value.replace(/[^0-9-]/g, ""))} />
            </label>
            <label>
              <span className="label">Pages</span>
              <input className="input tabular-nums" name="pages" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={draft.pages} onChange={(e) => set("pages", e.target.value.replace(/[^0-9]/g, ""))} />
            </label>
          </div>
          <label className="sm:col-span-2">
            <span className="label">Cover image address (https)</span>
            <input className="input" name="coverUrl" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://covers.openlibrary.org/…" value={draft.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} />
          </label>
          {choices.genres.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className="label">Subjects{suggested.length > 0 ? " (ticked ones were suggested by the search)" : ""}</legend>
              <div className="flex flex-wrap gap-x-5">
                {choices.genres.map((g) => (
                  <label key={g} className="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-9">
                    <input type="checkbox" className="size-4 accent-(--stamp)" checked={draft.genres.includes(g)} onChange={(e) => set("genres", e.target.checked ? [...draft.genres, g] : draft.genres.filter((x) => x !== g))} />
                    {g}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {duplicates.length > 0 && (
            <div role="alert" className="border-l-[3px] border-red pl-3 sm:col-span-2">
              <p className="font-bold">Already in the catalog?</p>
              <ul className="mb-1">
                {duplicates.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/book/${d.slug}`} className="link" target="_blank">
                      {d.rank != null ? `№ ${formatRank(d.rank)} ` : ""}
                      {d.title}
                      {d.author ? `, ${d.author}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 accent-(--stamp)" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />
                Add it anyway
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2">
            <button className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {saving ? "Adding…" : "Add to catalog"}
            </button>
            {msg && (
              <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "" : "text-red"}>
                {msg.text}{" "}
                {msg.slug && (
                  <Link href="/ranks" className="link">
                    Give it a rank
                  </Link>
                )}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
