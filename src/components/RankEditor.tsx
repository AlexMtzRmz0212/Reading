"use client";

import { ArrowDownIcon, ArrowUpIcon, DotsSixVerticalIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { catalogAuthor, plural } from "@/lib/format";
import { MAX_RANKS, formatRank, rankProblems, type RankChange } from "@/lib/ranks";
import { Spinner } from "./Bits";

export interface RankBook {
  id: string;
  title: string;
  author?: string;
  rank: number | null;
  score?: number;
}

const focus = (id: string) => document.getElementById(id)?.focus();
const place = (n: number | null) => (n == null ? "uncatalogued" : formatRank(n));

/** Score field: 0 to 10 in half steps, written to Notion when you leave the field or press Enter. */
function ScoreField({ book, onSaved }: { book: RankBook; onSaved: (text: string, ok: boolean) => void }) {
  const [saved, setSaved] = useState(book.score);
  const [draft, setDraft] = useState(book.score == null ? "" : String(book.score));
  const [busy, setBusy] = useState(false);

  async function commit() {
    const value = draft.trim() === "" ? null : Number(draft.replace(",", "."));
    if (value === (saved ?? null)) return;
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10 || (value * 2) % 1 !== 0)) {
      setDraft(saved == null ? "" : String(saved));
      return onSaved("A score goes from 0 to 10 in steps of 0.5.", false);
    }
    setBusy(true);
    const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ score: value }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setSaved(value ?? undefined);
      onSaved(value == null ? `Cleared the score of ${book.title}.` : `Scored ${book.title} ${value}.`, true);
    } else {
      setDraft(saved == null ? "" : String(saved));
      onSaved(`Couldn’t save the score of ${book.title}. Try again.`, false);
    }
  }

  return (
    <input
      className="input w-14 px-1 text-center tabular-nums"
      inputMode="decimal"
      autoComplete="off"
      aria-label={`Score of ${book.title}, 0 to 10`}
      placeholder="–"
      value={draft}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 4))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void commit();
        }
      }}
    />
  );
}

/** Owner screen for the Top list: put books in order, pull them in from the Uncatalogued pile, review what moves, then write it. */
export function RankEditor({ list, pile }: { list: RankBook[]; pile: RankBook[] }) {
  const router = useRouter();
  const saved = useMemo(() => list.map((b) => b.id), [list]);
  const [order, setOrder] = useState(saved);
  const [review, setReview] = useState<RankChange[] | null>(null);
  const [busy, setBusy] = useState<"" | "review" | "apply">("");
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // What the last edit did, read out by screen readers (the list itself shows it).
  const [said, setSaid] = useState("");
  // Drag and drop: the row being dragged (armed from its handle) and the gap it would land in.
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [gap, setGap] = useState<number | null>(null);

  // After a save the page sends the new list; start again from it.
  const savedKey = saved.join();
  const [base, setBase] = useState(savedKey);
  if (base !== savedKey) {
    setBase(savedKey);
    setOrder(saved);
    setReview(null);
  }

  const byId = useMemo(() => new Map([...list, ...pile].map((b) => [b.id, b])), [list, pile]);
  const books = order.map((id) => byId.get(id)!);
  const waiting = [...byId.values()].filter((b) => !order.includes(b.id)).sort((a, b) => a.title.localeCompare(b.title));
  const problems = rankProblems(list);
  const untidy = problems.shared.length > 0 || problems.missing.length > 0;
  const dirty = order.length !== saved.length || order.some((id, i) => id !== saved[i]);
  const working = busy !== "";

  // Leaving with an unsaved order asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Edits render right away (flushSync) so focus can go to a control that still exists and isn’t disabled.
  const edit = (next: string[], note: string) => {
    flushSync(() => {
      setOrder(next);
      setReview(null);
      setMsg(null);
      setSaid(note);
    });
  };
  const moveTo = (id: string, to: number) => {
    const without = order.filter((x) => x !== id);
    const at = Math.max(0, Math.min(without.length, to));
    edit([...without.slice(0, at), id, ...without.slice(at)], `${byId.get(id)!.title} is now number ${at + 1}.`);
  };
  const step = (i: number, by: -1 | 1) => {
    const id = order[i];
    moveTo(id, i + by);
    const to = i + by;
    focus(to === 0 ? `rank-down-${id}` : to === order.length - 1 ? `rank-up-${id}` : `rank-${by < 0 ? "up" : "down"}-${id}`);
  };
  const remove = (i: number) => {
    const next = order.filter((_, j) => j !== i);
    edit(next, `Moved ${byId.get(order[i])!.title} to the Uncatalogued pile.`);
    const neighbour = next[i] ?? next[i - 1];
    focus(neighbour ? `rank-remove-${neighbour}` : "ranks-title");
  };

  const drop = () => {
    if (dragging && gap != null) {
      const from = order.indexOf(dragging);
      // Taking the row out shifts everything after it up by one.
      moveTo(dragging, from !== -1 && from < gap ? gap - 1 : gap);
    }
    setDragging(null);
    setArmed(null);
    setGap(null);
  };
  const dragProps = (id: string) => ({
    draggable: armed === id,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", byId.get(id)!.title);
      setDragging(id);
    },
    onDragEnd: () => {
      setDragging(null);
      setArmed(null);
      setGap(null);
    },
  });
  const handle = (id: string, title: string) => (
    <span
      aria-hidden
      title={`Drag ${title}`}
      className="hidden w-6 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-soft active:cursor-grabbing sm:flex"
      onPointerDown={() => setArmed(id)}
      onPointerUp={() => setArmed(null)}
    >
      <DotsSixVerticalIcon size={18} />
    </span>
  );

  async function post(apply: boolean) {
    const res = await fetch("/api/ranks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order, apply }) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { changes?: RankChange[]; applied?: number; remaining?: number; error?: string };
    return res?.ok ? data : { error: data.error ?? "Couldn’t reach the server. Try again." };
  }

  async function preview() {
    setBusy("review");
    setMsg(null);
    const data = await post(false);
    setBusy("");
    if (data.error || !data.changes) return setMsg({ ok: false, text: data.error ?? "Couldn’t work out the changes." });
    setReview(data.changes);
    if (data.changes.length === 0) setMsg({ ok: true, text: "Nothing to change: Notion already has this order." });
  }

  async function apply() {
    if (!review) return;
    setBusy("apply");
    setMsg(null);
    const total = review.length;
    let done = 0;
    // A few rows per request, so a long reorder never outlives a serverless function.
    for (;;) {
      setProgress(`Writing ${Math.min(done + 1, total)} of ${total}…`);
      const data = await post(true);
      if (data.error || data.remaining == null) {
        setBusy("");
        setProgress("");
        setMsg({ ok: false, text: `${data.error ?? "Something went wrong."} ${done} of ${total} were written; review again to finish the rest.` });
        setReview(null);
        router.refresh();
        return;
      }
      done += data.applied ?? 0;
      if (data.remaining === 0 || !data.applied) break;
    }
    setBusy("");
    setProgress("");
    setReview(null);
    setMsg({ ok: true, text: `Applied. ${plural(done, "book")} updated in Notion.` });
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <p role="status" className="sr-only">
        {said}
      </p>
      <h1 id="ranks-title" tabIndex={-1} className="page-title mb-2">
        Ranks
      </h1>
      <p className="mb-2 max-w-[62ch] text-soft">
        {plural(order.length, "book")} on the list, best first. Drag a row, use the arrows, or type a new number. Scores save as you leave the field.
      </p>
      {untidy && (
        <p className="mb-2 max-w-[62ch]">
          {problems.shared.length > 0 && `In Notion, ${plural(problems.shared.length, "place")} ${problems.shared.length === 1 ? "is" : "are"} held by two books (${problems.shared.map(formatRank).join(", ")}). `}
          {problems.missing.length > 0 && `${problems.missing.length === 1 ? "Number" : "Numbers"} ${problems.missing.map(formatRank).join(", ")} ${problems.missing.length === 1 ? "is" : "are"} unused. `}
          Applying gives every book its own number with no gaps.
        </p>
      )}

      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-3 bg-ground px-4 py-2 sm:-mx-6 sm:px-6">
        <button type="button" className="btn btn-primary" disabled={working || (!dirty && !untidy)} onClick={preview}>
          {busy === "review" && <Spinner />}
          {busy === "review" ? "Checking…" : "Review changes"}
        </button>
        {dirty && !working && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              // This button goes away with the changes, so focus moves up to the heading.
              edit(saved, "Back to the saved order.");
              focus("ranks-title");
            }}
          >
            Discard changes
          </button>
        )}
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "" : "text-red"}>
            {msg.text}
          </p>
        )}
      </div>

      {review && review.length > 0 && (
        <section aria-labelledby="review-title" className="slip mb-6 border-t-[1.5px] border-t-red p-4">
          <h2 id="review-title" tabIndex={-1} className="mb-1 font-serif text-xl leading-tight font-bold">
            {plural(review.length, "book")} will change in Notion
          </h2>
          <p className="mb-3 text-[13px] text-soft">Every other row is left alone.</p>
          <ul className="mb-4 max-h-64 overflow-y-auto border-y border-rule">
            {review.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5 last:border-b-0">
                <span className="min-w-0 truncate">{c.title}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {place(c.from)} <span aria-hidden>→</span>
                  <span className="sr-only"> to </span> {place(c.to)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={working} onClick={apply}>
              {busy === "apply" && <Spinner />}
              {busy === "apply" ? progress : `Apply ${plural(review.length, "change")}`}
            </button>
            <button type="button" className="btn" disabled={working} onClick={() => setReview(null)}>
              Keep editing
            </button>
          </div>
        </section>
      )}

      <h2 className="sr-only">The list</h2>
      {books.length === 0 ? (
        <p className="max-w-md rounded-[3px] border border-dashed border-soft/50 p-6 text-soft">Nothing is ranked yet. Add a book from the Uncatalogued pile below to start the list.</p>
      ) : (
        <ol
          className="slip"
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            const row = (e.target as Element).closest<HTMLElement>("[data-row]");
            if (!row) return;
            const box = row.getBoundingClientRect();
            setGap(Number(row.dataset.row) + (e.clientY > box.top + box.height / 2 ? 1 : 0));
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop();
          }}
        >
          {books.map((b, i) => {
            const change = b.rank == null ? "new" : b.rank !== i + 1 ? `was ${formatRank(b.rank)}` : "";
            return (
              <li
                key={b.id}
                data-row={i}
                {...dragProps(b.id)}
                className={`relative flex items-center gap-2 border-b border-rule py-1.5 pr-2 pl-2 last:border-b-0 sm:gap-3 sm:pl-1 ${dragging === b.id ? "opacity-40" : ""}`}
                style={gap === i ? { boxShadow: "inset 0 3px 0 var(--stamp)" } : gap === i + 1 && i === books.length - 1 ? { boxShadow: "inset 0 -3px 0 var(--stamp)" } : undefined}
              >
                {handle(b.id, b.title)}
                <input
                  key={`${b.id}-${i}`}
                  className="input w-14 px-1 text-center font-bold tabular-nums"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  aria-label={`Number of ${b.title}`}
                  defaultValue={formatRank(i + 1)}
                  disabled={working}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const to = parseInt(e.target.value, 10);
                    if (Number.isInteger(to) && to >= 1 && to - 1 !== i) moveTo(b.id, to - 1);
                    else e.target.value = formatRank(i + 1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[19px] leading-snug">{b.title}</p>
                  <p className="truncate text-[13px] text-soft">
                    {catalogAuthor(b.author)}
                    {change && <span className="ml-2 font-bold text-stamp">{change}</span>}
                  </p>
                </div>
                <ScoreField book={b} onSaved={(text, ok) => (ok ? setSaid(text) : setMsg({ ok, text }))} />
                <div className="flex shrink-0">
                  <button type="button" id={`rank-up-${b.id}`} className="btn w-11 border-transparent bg-transparent px-0 sm:w-10" aria-label={`Move ${b.title} up`} disabled={working || i === 0} onClick={() => step(i, -1)}>
                    <ArrowUpIcon size={16} aria-hidden />
                  </button>
                  <button type="button" id={`rank-down-${b.id}`} className="btn w-11 border-transparent bg-transparent px-0 sm:w-10" aria-label={`Move ${b.title} down`} disabled={working || i === books.length - 1} onClick={() => step(i, 1)}>
                    <ArrowDownIcon size={16} aria-hidden />
                  </button>
                  <button type="button" id={`rank-remove-${b.id}`} className="btn hidden w-10 border-transparent bg-transparent px-0 sm:inline-flex" aria-label={`Take ${b.title} off the list`} disabled={working} onClick={() => remove(i)}>
                    <XIcon size={16} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section aria-labelledby="pile-title" className="mt-10">
        <h2 id="pile-title" className="mb-1 font-serif text-2xl leading-tight font-bold">
          Uncatalogued
        </h2>
        <p className="mb-3 text-soft">{waiting.length === 0 ? "Every book has a number." : "Books with no number. Add one to the end of the list, or drag it to its place."}</p>
        {waiting.length > 0 && (
          <ul className="slip max-w-2xl">
            {waiting.map((b) => (
              <li key={b.id} {...dragProps(b.id)} className={`flex items-center gap-3 border-b border-rule py-1.5 pr-2 pl-2 last:border-b-0 sm:pl-1 ${dragging === b.id ? "opacity-40" : ""}`}>
                {handle(b.id, b.title)}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[19px] leading-snug">{b.title}</p>
                  <p className="truncate text-[13px] text-soft">{catalogAuthor(b.author)}</p>
                </div>
                <button type="button" className="btn" disabled={working || order.length >= MAX_RANKS} aria-label={`Add ${b.title} to the list`} onClick={() => edit([...order, b.id], `Added ${b.title} as number ${order.length + 1}.`)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
