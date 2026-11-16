"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { bestMatch, fillFrom, needsSearch, queriesFor, type Fill, type Gap } from "@/lib/enrich";
import type { SearchResult } from "@/lib/providers/types";
import type { Choices } from "@/lib/types";
import { Spinner } from "./Bits";

interface Proposal {
  book: Gap;
  fill: Fill;
  source: string;
}

const CONCURRENCY = 2;

/**
 * Owner only: books that lack a Genre or a Published date get them from a search. Nothing is written until you
 * have seen the list and pressed the button, and a value a book already has is never replaced.
 */
export function FillDetails({ gaps, choices }: { gaps: Gap[]; choices: Choices }) {
  const [phase, setPhase] = useState<"idle" | "searching" | "review" | "writing" | "done">("idle");
  const [done, setDone] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [unmatched, setUnmatched] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useRef(0);
  const router = useRouter();

  async function find() {
    const mine = ++run.current;
    setPhase("searching");
    setDone(0);
    setMsg(null);
    const found: Proposal[] = [];
    let none = 0;
    let next = 0;
    async function worker() {
      while (next < gaps.length && mine === run.current) {
        const book = gaps[next++];
        // A book that only needs its icon (it already has a cover) needs no search.
        let match: SearchResult | undefined;
        if (needsSearch(book)) {
          // Try the next wording until one finds the same book.
          for (const q of queriesFor(book)) {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).catch(() => null);
            const data = ((await res?.json().catch(() => null)) ?? {}) as { results?: SearchResult[] };
            match = bestMatch(book, data.results ?? []);
            if (match || mine !== run.current) break;
          }
        }
        const fill = fillFrom(book, match, choices);
        if (fill) found.push({ book, fill, source: match?.source ?? "its own cover" });
        else none++;
        setDone((n) => n + 1);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (mine !== run.current) return;
    found.sort((a, b) => a.book.title.localeCompare(b.book.title));
    setProposals(found);
    setUnmatched(none);
    setSkipped(new Set());
    setPhase("review");
  }

  async function write() {
    const changes = proposals.filter((p) => !skipped.has(p.book.id)).map((p) => p.fill);
    if (changes.length === 0) return;
    setPhase("writing");
    const res = await fetch("/api/enrich", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes }) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { updated?: number; error?: string };
    if (res?.ok) {
      router.refresh();
      setMsg({ ok: true, text: `Filled in ${data.updated ?? changes.length} books in Notion.` });
      setPhase("done");
    } else {
      setMsg({ ok: false, text: data.error ?? "Couldn’t reach the server. Nothing was changed." });
      setPhase("review");
    }
  }

  const chosen = proposals.length - skipped.size;
  const toggle = (id: string) =>
    setSkipped((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="fill-details" className="mt-12 border-t border-rule pt-8">
      <h2 id="fill-details" className="mb-2 font-serif text-2xl leading-tight font-bold">
        Fill in missing details
      </h2>
      {/* Covers become the Notion page cover and icon, the same as when a book is added here. */}
      {gaps.length === 0 ? (
        <p className="text-soft">Every book has a cover, an icon, a Genre and a Published date.</p>
      ) : (
        <>
          <p className="mb-4 max-w-[60ch] text-soft">
            {gaps.length} {gaps.length === 1 ? "book is" : "books are"} missing a cover, an icon, a Genre or a Published date. Search finds them; you check the list before anything is written.
          </p>
          {(phase === "idle" || phase === "done") && (
            <button type="button" className="btn" onClick={() => void find()}>
              {phase === "done" ? "Search again" : "Find details"}
            </button>
          )}
          {phase === "searching" && (
            <p role="status" className="flex items-center gap-2 text-soft">
              <Spinner />
              Searched {done} of {gaps.length}…
            </p>
          )}
          {(phase === "review" || phase === "writing") && (
            <>
              <p className="mb-2 text-[13px] text-soft">
                {proposals.length} found, {unmatched} with no sure match (left alone).
              </p>
              {proposals.length > 0 && (
                <ul className="slip mb-4 divide-y divide-rule">
                  {proposals.map((p) => (
                    <li key={p.book.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2">
                        <input type="checkbox" className="size-4 accent-(--stamp)" checked={!skipped.has(p.book.id)} onChange={() => toggle(p.book.id)} disabled={phase === "writing"} />
                        <span className="aspect-[2/3] w-8 shrink-0 bg-edge">
                          {(p.fill.cover ?? p.book.coverUrl) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={(p.fill.cover ?? p.book.coverUrl)!.replace("-L.jpg", "-S.jpg")} alt="" width={32} height={48} loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-[17px] leading-snug">{p.book.title}</span>
                          <span className="block truncate text-[13px] text-soft">
                            {[p.fill.cover && "Cover", p.fill.icon && "Icon", p.fill.published && `Published ${p.fill.published.slice(0, 4)}`, p.fill.genres && `Genre ${p.fill.genres.join(", ")}`, p.source].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary" disabled={phase === "writing" || chosen === 0} onClick={() => void write()}>
                  {phase === "writing" && <Spinner />}
                  {phase === "writing" ? "Writing…" : `Write ${chosen} to Notion`}
                </button>
                <button type="button" className="btn btn-quiet" disabled={phase === "writing"} onClick={() => setPhase("idle")}>
                  Discard
                </button>
              </div>
            </>
          )}
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`mt-3 ${msg.ok ? "text-soft" : "text-red"}`}>
              {msg.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}
