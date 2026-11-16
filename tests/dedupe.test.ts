import { describe, expect, it } from "vitest";
import { findDuplicates, matchOption } from "@/lib/dedupe";
import { authorSortKey, catalogAuthor, normalize, percentRead, slugify, stampDate, subjectHeadings, today } from "@/lib/format";

describe("normalize", () => {
  it("ignores accents, case, punctuation and extra spaces", () => {
    expect(normalize("  Antoine de Saint-Exupéry ")).toBe("antoine de saint exupery");
    expect(normalize("¿Qué es el Arte?")).toBe("que es el arte");
    expect(normalize("H.P. Lovecraft")).toBe("h p lovecraft");
  });

  it("keeps non-Latin scripts", () => {
    expect(normalize("孫子兵法")).toBe("孫子兵法");
    expect(normalize("Περὶ Ψυχῆς")).not.toBe("");
  });
});

describe("author options", () => {
  const options = ["Antoine de Saint-Exupéry", "Antoine de Saint-Exupery", "George Orwell", "René Descartes"];

  it("reuses an existing option instead of making a near-duplicate", () => {
    expect(matchOption("antoine de saint exupery", options)).toBe("Antoine de Saint-Exupéry");
    expect(matchOption("Rene  Descartes", options)).toBe("René Descartes");
    expect(matchOption("GEORGE ORWELL", options)).toBe("George Orwell");
  });

  it("prefers an exact match where two options normalize the same", () => {
    expect(matchOption("Antoine de Saint-Exupery", options)).toBe("Antoine de Saint-Exupery");
  });

  it("returns nothing for a new author", () => {
    expect(matchOption("Frank Herbert", options)).toBeUndefined();
    expect(matchOption("  ", options)).toBeUndefined();
  });
});

describe("duplicates", () => {
  const books = [
    { title: "El principe", originalTitle: "Il principe", author: "Nicolas Maquiavelo" },
    { title: "The Little Prince", originalTitle: "Le Petit Prince", author: "Antoine de Saint-Exupery" },
    { title: "Quiet", originalTitle: "Quiet: The Power of Introverts in a World That Can't Stop Talking", author: "Susan Cain" },
    { title: "Rebelión de la granja", author: "George Orwell" },
    { title: "Ética", author: "Baruch Spinoza" },
  ];
  const titles = (c: { title: string; originalTitle?: string; author?: string }) => findDuplicates(c, books).map((b) => b.title);

  it("matches on title or original title, whatever the accents", () => {
    expect(titles({ title: "El Príncipe" })).toEqual(["El principe"]);
    expect(titles({ title: "Le petit prince", author: "Antoine de Saint-Exupéry" })).toEqual(["The Little Prince"]);
    expect(titles({ title: "Il Principe", author: "Niccolò Machiavelli" })).toEqual([]);
  });

  it("ignores subtitles", () => {
    expect(titles({ title: "Quiet: The Power of Introverts", author: "Susan Cain" })).toEqual(["Quiet"]);
  });

  it("a same-titled book by someone else isn't a duplicate", () => {
    expect(titles({ title: "Ética", author: "Aristotle" })).toEqual([]);
    expect(titles({ title: "Ética", author: "Spinoza" })).toEqual(["Ética"]);
    expect(titles({ title: "Ética" })).toEqual(["Ética"]);
  });

  it("finds nothing for a new book or an empty title", () => {
    expect(titles({ title: "Dune", author: "Frank Herbert" })).toEqual([]);
    expect(titles({ title: " " })).toEqual([]);
  });
});

describe("card formatting", () => {
  it("files authors surname first", () => {
    expect(catalogAuthor("George Orwell")).toBe("ORWELL, George");
    expect(catalogAuthor("Antoine de Saint-Exupéry")).toBe("SAINT-EXUPÉRY, Antoine de");
    expect(catalogAuthor("Plato")).toBe("PLATO");
    expect(catalogAuthor("James Tynion IV")).toBe("TYNION, James, IV");
    expect(catalogAuthor("Georg Wilhelm Friedrich Hegel")).toBe("HEGEL, Georg Wilhelm Friedrich");
    expect(catalogAuthor("Friedrich Engels y Karl Marx")).toBe("ENGELS, Friedrich y Karl Marx");
    expect(catalogAuthor("Robert Kiyosaki and Sharon Lechter")).toBe("KIYOSAKI, Robert and Sharon Lechter");
    expect(catalogAuthor(undefined)).toBe("");
  });

  it("sorts authors by surname, blanks last", () => {
    const sorted = ["Simone de Beauvoir", undefined, "Aristotle", "Stephen King", "Diógenes Laercio"].sort((a, b) => authorSortKey(a).localeCompare(authorSortKey(b)));
    expect(sorted).toEqual(["Aristotle", "Simone de Beauvoir", "Stephen King", "Diógenes Laercio", undefined]);
  });

  it("builds stable slugs", () => {
    expect(slugify("¿Qué es el Arte?", "53e76da1-82fe-4940-a962-72dbb26b6ace")).toBe("que-es-el-arte-53e76da1");
    expect(slugify("孫子兵法", "08649394ad7c")).toBe("book-08649394");
  });

  it("numbers subject headings and prints stamp dates", () => {
    expect(subjectHeadings(["Dystopia", "Fiction"])).toBe("1. Dystopia. 2. Fiction.");
    expect(subjectHeadings([])).toBe("");
    expect(stampDate("2025-05-30")).toBe("MAY 30 2025");
    expect(stampDate(undefined)).toBe("");
  });

  it("works out percent read locally", () => {
    expect(percentRead({ pages: 638, currentPage: 132, status: "In progress" })).toBe(21);
    expect(percentRead({ pages: 300, currentPage: 900, status: "In progress" })).toBe(100);
    expect(percentRead({ status: "Done" })).toBe(100);
    expect(percentRead({ status: "In progress", currentPage: 20 })).toBeNull();
    expect(percentRead({ status: "Not started", pages: 200 })).toBeNull();
  });

  it("today follows the owner's time zone", () => {
    const lateEvening = new Date("2026-11-16T04:30:00Z");
    expect(today("America/Mexico_City", lateEvening)).toBe("2026-11-15");
    expect(today("UTC", lateEvening)).toBe("2026-11-16");
    expect(today("Not/AZone", lateEvening)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
