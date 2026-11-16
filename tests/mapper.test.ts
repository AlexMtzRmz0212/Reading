import { describe, expect, it } from "vitest";
import { newBookToProperties, pageToBook, patchToProperties } from "@/lib/notion/mapper";

const rt = (s: string) => [{ plain_text: s }];

const fullPage = {
  object: "page",
  id: "0c43d891-0055-4d43-a383-ee61308e9588",
  cover: { type: "external", external: { url: "https://covers.openlibrary.org/b/id/1-L.jpg" } },
  properties: {
    Name: { title: rt("El Mundo de Sofía") },
    "Original Name": { rich_text: rt("Sofies verden") },
    Author: { select: { name: "Jostein Gaarder" } },
    Genre: { multi_select: [{ name: "Fiction" }, { name: "History" }] },
    Published: { date: { start: "1991-01-01" } },
    Pages: { number: 638 },
    "Current page": { number: 132 },
    "Progress percentage": { formula: { type: "number", number: 0.2 } },
    Status: { status: { name: "In progress" } },
    Started: { date: { start: "2022-01-29" } },
    Completed: { date: null },
    Relevancy: { select: { name: "05" } },
    "Score": { number: 8.5 },
  },
};

describe("pageToBook", () => {
  it("maps a full row", () => {
    expect(pageToBook(fullPage, "Name")).toEqual({
      id: "0c43d891-0055-4d43-a383-ee61308e9588",
      slug: "el-mundo-de-sofia-0c43d891",
      title: "El Mundo de Sofía",
      originalTitle: "Sofies verden",
      author: "Jostein Gaarder",
      genres: ["Fiction", "History"],
      published: "1991-01-01",
      year: "1991",
      pages: 638,
      currentPage: 132,
      status: "In progress",
      rank: 5,
      score: 8.5,
      started: "2022-01-29",
      completed: undefined,
      coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
      hasIcon: false,
    });
  });

  it("maps a row with nearly everything missing (an article or TV entry)", () => {
    const book = pageToBook({ object: "page", id: "abc", properties: { Name: { title: rt("  Some article ") } } }, "Name");
    expect(book).toMatchObject({ title: "Some article", genres: [], status: "Not started", rank: null });
    expect(book.author).toBeUndefined();
    expect(book.pages).toBeUndefined();
    expect(book.coverUrl).toBeUndefined();
  });

  it("survives a page with no properties at all", () => {
    expect(pageToBook({ id: "x" }, "Name")).toMatchObject({ title: "", slug: "book-x", rank: null, status: "Not started" });
  });

  it("treats odd values as absent", () => {
    const book = pageToBook(
      { id: "abc", properties: { Name: { title: rt("X") }, Relevancy: { select: { name: "soon" } }, Status: { status: { name: "Paused" } }, Pages: { number: 0 }, Started: { date: { start: "2024-03-01T10:00:00.000-06:00" } } } },
      "Name",
    );
    expect(book.rank).toBeNull();
    expect(book.status).toBe("Not started");
    expect(book.pages).toBeUndefined();
    expect(book.started).toBe("2024-03-01");
  });

  it("reads a Notion-hosted cover too", () => {
    expect(pageToBook({ id: "a", cover: { type: "file", file: { url: "https://files.notion/x.png" } }, properties: {} }, "Name").coverUrl).toBe("https://files.notion/x.png");
  });
});

describe("writes", () => {
  it("sends only the fields in the patch", () => {
    expect(patchToProperties({ currentPage: 40 })).toEqual({ "Current page": { number: 40 } });
    expect(patchToProperties({})).toEqual({});
  });

  it("writes Relevancy as a zero-padded select and clears it with null", () => {
    expect(patchToProperties({ rank: 7 })).toEqual({ Relevancy: { select: { name: "07" } } });
    expect(patchToProperties({ rank: 104 })).toEqual({ Relevancy: { select: { name: "104" } } });
    expect(patchToProperties({ rank: null })).toEqual({ Relevancy: { select: null } });
  });

  it("writes status and dates, and clears dates with null", () => {
    expect(patchToProperties({ status: "Done", completed: "2026-11-15", started: null, score: null })).toEqual({
      Status: { status: { name: "Done" } },
      Completed: { date: { start: "2026-11-15" } },
      Started: { date: null },
      "Score": { number: null },
    });
  });

  it("builds a new row: Not started, Published as a date, no Relevancy", () => {
    const props = newBookToProperties({ title: "Dune", originalTitle: "Dune", author: "Frank Herbert", genres: ["Science fiction"], published: "1965-01-01", pages: 612 }, "Name");
    expect(props.Name).toEqual({ title: [{ type: "text", text: { content: "Dune" } }] });
    expect(props.Status).toEqual({ status: { name: "Not started" } });
    expect(props.Author).toEqual({ select: { name: "Frank Herbert" } });
    expect(props.Published).toEqual({ date: { start: "1965-01-01" } });
    expect(props.Pages).toEqual({ number: 612 });
    expect(props).not.toHaveProperty("Relevancy");
  });

  it("leaves out what a manual entry didn't fill in", () => {
    expect(Object.keys(newBookToProperties({ title: "Untitled" }, "Name")).sort()).toEqual(["Name", "Status"]);
  });
});
