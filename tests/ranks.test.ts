import { describe, expect, it } from "vitest";
import { formatRank, parseOrder, parseRank, parseScore, rankChanges, rankProblems, ranked } from "@/lib/ranks";

const books = [
  { id: "a", title: "Atomic Habits", rank: 2 },
  { id: "b", title: "The Chain", rank: 1 },
  { id: "c", title: "Man's Search for Meaning", rank: 1 },
  { id: "d", title: "Dune", rank: null },
  { id: "e", title: "The Daily Laws", rank: 4 },
];

describe("parse and format", () => {
  it("reads the Top select's text values", () => {
    expect(parseRank("07")).toBe(7);
    expect(parseRank("92")).toBe(92);
    expect(parseRank("104")).toBe(104);
    for (const bad of [undefined, null, "", "00", "soon", "7b", "-1", "1.5"]) expect(parseRank(bad)).toBeNull();
  });

  it("pads to two digits, three from 100", () => {
    expect(formatRank(7)).toBe("07");
    expect(formatRank(92)).toBe("92");
    expect(formatRank(100)).toBe("100");
    expect(parseRank(formatRank(9))).toBe(9);
  });
});

describe("the list", () => {
  it("orders by place, then title", () => {
    expect(ranked(books).map((b) => b.id)).toEqual(["c", "b", "a", "e"]);
  });

  it("finds shared and missing places", () => {
    expect(rankProblems(books)).toEqual({ shared: [1], missing: [3] });
    expect(rankProblems([{ rank: 1 }, { rank: 2 }, { rank: null }])).toEqual({ shared: [], missing: [] });
    expect(rankProblems([])).toEqual({ shared: [], missing: [] });
  });

  it("a swap changes exactly two rows", () => {
    const tidy = [
      { id: "a", title: "A", rank: 1 },
      { id: "b", title: "B", rank: 2 },
      { id: "c", title: "C", rank: 3 },
    ];
    expect(rankChanges(tidy, ["b", "a", "c"])).toEqual([
      { id: "b", title: "B", from: 2, to: 1 },
      { id: "a", title: "A", from: 1, to: 2 },
    ]);
    expect(rankChanges(tidy, ["a", "b", "c"])).toEqual([]);
  });

  it("reordering makes places unique and contiguous, adds from the pile, and drops what is left out", () => {
    const changes = rankChanges(books, ["c", "b", "a", "d"]);
    expect(changes).toEqual([
      { id: "b", title: "The Chain", from: 1, to: 2 },
      { id: "a", title: "Atomic Habits", from: 2, to: 3 },
      { id: "d", title: "Dune", from: null, to: 4 },
      { id: "e", title: "The Daily Laws", from: 4, to: null },
    ]);
    const after = books.map((b) => ({ ...b, rank: changes.find((c) => c.id === b.id)?.to ?? (changes.some((c) => c.id === b.id) ? null : b.rank) }));
    expect(rankProblems(after)).toEqual({ shared: [], missing: [] });
  });
});

describe("request validation", () => {
  const ids = new Set(books.map((b) => b.id));

  it("accepts known ids, each once", () => {
    expect(parseOrder({ order: ["a", "b"] }, ids)).toEqual({ ok: true, value: ["a", "b"] });
    expect(parseOrder({ order: [] }, ids)).toEqual({ ok: true, value: [] });
  });

  it("rejects repeats, unknown ids and junk", () => {
    expect(parseOrder({ order: ["a", "a"] }, ids).ok).toBe(false);
    expect(parseOrder({ order: ["zzz"] }, ids).ok).toBe(false);
    expect(parseOrder({ order: "a" }, ids).ok).toBe(false);
    expect(parseOrder({ order: [1, 2] }, ids).ok).toBe(false);
    expect(parseOrder({}, ids).ok).toBe(false);
  });

  it("scores go 0 to 10 in half steps, or null", () => {
    for (const ok of [0, 0.5, 7, 9.5, 10, null]) expect(parseScore(ok)).toEqual({ ok: true, value: ok });
    for (const bad of [-0.5, 10.5, 7.3, "8", undefined, NaN]) expect(parseScore(bad).ok).toBe(false);
  });
});
