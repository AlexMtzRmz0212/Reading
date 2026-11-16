"use client";

import { MinusIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { today } from "@/lib/format";
import { applyProgress, logPage, markFinished, snapshot, type ProgressPatch } from "@/lib/progress";
import type { Book } from "@/lib/types";
import { Spinner } from "./Bits";

type Body = { page: number } | { finished: true } | { restore: Required<ProgressPatch> };

/**
 * Owner only: log the page you’re on, or mark the book finished. The change shows at once and is written to Notion
 * behind it; if the write fails the book goes back to how it was. Undo sends the previous values back.
 */
export function ProgressLogger({ book, onChange }: { book: Book; onChange: (book: Book) => void }) {
  const [draft, setDraft] = useState(String(book.currentPage ?? ""));
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Required<ProgressPatch> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pagesDraft, setPagesDraft] = useState(book.pages ? String(book.pages) : "");
  const fieldId = `page-${book.id}`;
  const pagesId = `pages-${book.id}`;
  // The total is locked (read-only) until the owner presses Edit.
  const [editingPages, setEditingPages] = useState(false);
  const errorId = `${fieldId}-error`;

  // The book changed under us (another logger for the same book, a refresh): show its page.
  const [seenPage, setSeenPage] = useState(book.currentPage);
  if (seenPage !== book.currentPage) {
    setSeenPage(book.currentPage);
    setDraft(String(book.currentPage ?? ""));
  }

  async function send(body: Body, optimistic: ProgressPatch, done: string) {
    const before = book;
    setBusy(true);
    setMsg(null);
    onChange(applyProgress(book, optimistic));
    const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { book?: Book; error?: string };
    if (res?.ok && data.book) {
      onChange(data.book);
      setUndo("restore" in body ? null : snapshot(before));
      setMsg({ ok: true, text: done });
    } else {
      onChange(before);
      setMsg({ ok: false, text: data.error ?? "Couldn’t reach the server. Nothing was changed." });
    }
    setBusy(false);
  }

  function log(page: number) {
    const result = logPage(book, page, today());
    if (!result.ok) return setMsg({ ok: false, text: result.error });
    if (Object.keys(result.value).length === 0) return setMsg({ ok: true, text: `Already on page ${page}.` });
    const finished = result.value.status === "Done";
    void send({ page }, result.value, finished ? "Finished. Stamped in Notion." : `Logged page ${result.value.currentPage ?? page}.`);
  }

  /** Close the inline editor; `save` writes the draft (shown at once, put back if the write fails). */
  async function finishPages(save: boolean) {
    if (!editingPages) return;
    setEditingPages(false);
    if (!save) return;
    const value = pagesDraft.trim() === "" ? null : Number(pagesDraft);
    if (value === (book.pages ?? null)) return;
    if (value !== null && (!Number.isInteger(value) || value < 1)) return setMsg({ ok: false, text: "Total pages must be a whole number, 1 or more." });
    const before = book;
    setMsg(null);
    onChange({ ...book, pages: value ?? undefined });
    const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages: value }) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { book?: Book; error?: string };
    if (res?.ok && data.book) {
      onChange(data.book);
      setMsg({ ok: true, text: value === null ? "Cleared the total pages." : `Total pages set to ${value}.` });
    } else {
      onChange(before);
      setMsg({ ok: false, text: data.error ?? "Couldn’t reach the server. Nothing was changed." });
    }
  }

  const typed = draft.trim() === "" ? NaN : Number(draft);
  const current = book.currentPage ?? 0;
  const step = (by: number) => setDraft(String(Math.max(0, Math.min(book.pages ?? Infinity, (Number.isFinite(typed) ? typed : current) + by))));

  return (
    <form
      className="border-t border-rule px-3.5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!Number.isInteger(typed) || typed < 0) return setMsg({ ok: false, text: "Type the page you’re on as a whole number." });
        log(typed);
      }}
    >
      <label htmlFor={fieldId} className="label">
        Current page{book.pages ? ` (of ${book.pages})` : ""}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex">
          <button type="button" className="btn w-11 rounded-r-none border-r-0 px-0 sm:w-10" aria-label="One page back" disabled={busy} onClick={() => step(-1)}>
            <MinusIcon size={14} aria-hidden />
          </button>
          <input
            id={fieldId}
            className="input w-20 rounded-none text-center tabular-nums"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            disabled={busy}
            aria-invalid={msg && !msg.ok ? true : undefined}
            aria-describedby={msg && !msg.ok ? errorId : undefined}
          />
          <button type="button" className="btn w-11 rounded-l-none border-l-0 px-0 sm:w-10" aria-label="One page forward" disabled={busy} onClick={() => step(1)}>
            <PlusIcon size={14} aria-hidden />
          </button>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy && <Spinner />}
          Log page
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => log(current + 10)} aria-label="Log 10 more pages">
          +10
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => log(current + 25)} aria-label="Log 25 more pages">
          +25
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={pagesId} className="text-[13px] text-soft">
          Total pages
        </label>
        {/* Locked until clicked; then the number itself becomes the field, in the same spot. Enter or click away saves, Escape cancels. */}
        {editingPages ? (
          <input
            id={pagesId}
            autoFocus
            className="input h-8 w-20 text-center tabular-nums"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="–"
            value={pagesDraft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setPagesDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onBlur={() => void finishPages(true)}
            onKeyDown={(e) => {
              // Enter here saves the total, not the current page.
              if (e.key === "Enter") {
                e.preventDefault();
                void finishPages(true);
              } else if (e.key === "Escape") {
                void finishPages(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            id={pagesId}
            className="group inline-flex h-8 w-20 items-center justify-center gap-1.5 rounded-[3px] border border-transparent tabular-nums transition-colors hover:border-rule hover:bg-ground/60"
            aria-label={`Total pages: ${book.pages ?? "not set"}. Edit`}
            onClick={() => {
              setPagesDraft(book.pages ? String(book.pages) : "");
              setEditingPages(true);
            }}
          >
            {book.pages ?? "–"}
            <PencilSimpleIcon size={12} aria-hidden className="text-soft opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {book.status !== "Done" && (
          <button type="button" className="btn btn-quiet px-0" disabled={busy} onClick={() => void send({ finished: true }, markFinished(book, today()), "Finished. Stamped in Notion.")}>
            Mark finished
          </button>
        )}
        {undo && (
          <button type="button" className="btn btn-quiet px-0" disabled={busy} onClick={() => void send({ restore: undo }, undo, "Undone.")}>
            Undo
          </button>
        )}
        {msg && (
          <p id={errorId} role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-soft" : "text-red"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
