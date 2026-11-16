import { describe, expect, it } from "vitest";
import { applyProgress, logPage, markFinished, parseRestore, snapshot, type ProgressState } from "@/lib/progress";

const TODAY = "2026-11-15";
const fresh: ProgressState = { status: "Not started", pages: 300 };
const reading: ProgressState = { status: "In progress", pages: 300, currentPage: 120, started: "2026-10-01" };

const patchOf = (book: ProgressState, page: unknown) => {
  const r = logPage(book, page, TODAY);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("logPage", () => {
  it("starts a book: In progress, Started today", () => {
    expect(patchOf(fresh, 12)).toEqual({ currentPage: 12, status: "In progress", started: TODAY });
  });

  it("just moves the page on a book already going, and never overwrites Started", () => {
    expect(patchOf(reading, 150)).toEqual({ currentPage: 150 });
    expect(patchOf({ ...reading, status: "Not started" }, 150)).toEqual({ currentPage: 150, status: "In progress" });
  });

  it("finishes on the last page: Done, Completed today, page set to the last", () => {
    expect(patchOf(reading, 300)).toEqual({ currentPage: 300, status: "Done", completed: TODAY });
    expect(patchOf(reading, 999)).toEqual({ currentPage: 300, status: "Done", completed: TODAY });
  });

  it("read in one sitting: Started and Completed both today", () => {
    expect(patchOf(fresh, 300)).toEqual({ currentPage: 300, status: "Done", completed: TODAY, started: TODAY });
  });

  it("keeps an existing Completed date", () => {
    expect(patchOf({ status: "Done", pages: 300, currentPage: 280, completed: "2020-01-01" }, 300)).toEqual({ currentPage: 300 });
  });

  it("going back from Done reopens the book", () => {
    expect(patchOf({ status: "Done", pages: 300, currentPage: 300, started: "2026-01-01", completed: "2026-02-01" }, 250)).toEqual({ currentPage: 250, status: "In progress", completed: null });
  });

  it("page 0 doesn't start anything", () => {
    expect(patchOf(fresh, 0)).toEqual({ currentPage: 0 });
  });

  it("without a page count nothing finishes by itself", () => {
    expect(patchOf({ status: "Not started" }, 500)).toEqual({ currentPage: 500, status: "In progress", started: TODAY });
  });

  it("no change, empty patch", () => {
    expect(patchOf(reading, 120)).toEqual({});
  });

  it("rejects anything that isn't a whole page", () => {
    for (const bad of [-1, 1.5, "12", null, undefined, NaN, Infinity, 1e9]) expect(logPage(reading, bad, TODAY).ok).toBe(false);
  });
});

describe("markFinished", () => {
  it("stamps Done and jumps to the last page", () => {
    expect(markFinished(reading, TODAY)).toEqual({ status: "Done", completed: TODAY, currentPage: 300 });
  });

  it("works without a page count", () => {
    expect(markFinished({ status: "In progress", started: "2026-01-01" }, TODAY)).toEqual({ status: "Done", completed: TODAY });
  });

  it("is a no-op on a finished book", () => {
    expect(markFinished({ status: "Done", pages: 300, currentPage: 300, completed: "2025-01-01" }, TODAY)).toEqual({});
  });
});

describe("undo", () => {
  it("restoring the snapshot puts the book back", () => {
    const patch = patchOf(fresh, 300);
    const after = applyProgress(fresh, patch);
    expect(after).toMatchObject({ status: "Done", currentPage: 300, started: TODAY, completed: TODAY });
    const restore = parseRestore(JSON.parse(JSON.stringify(snapshot(fresh))));
    expect(restore).toEqual({ ok: true, value: { status: "Not started", currentPage: null, started: null, completed: null } });
    if (restore.ok) expect(applyProgress(after, restore.value)).toEqual({ status: "Not started", pages: 300, currentPage: undefined, started: undefined, completed: undefined });
  });

  it("validates what it is sent", () => {
    expect(parseRestore(null).ok).toBe(false);
    expect(parseRestore({ status: "Paused" }).ok).toBe(false);
    expect(parseRestore({ status: "Done", currentPage: -3 }).ok).toBe(false);
    expect(parseRestore({ status: "Done", started: "yesterday" }).ok).toBe(false);
    expect(parseRestore({ status: "Done", completed: "2026-13-45" }).ok).toBe(false);
  });
});
