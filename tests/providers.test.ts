import { describe, expect, it } from "vitest";
import { mapGoogleVolume } from "@/lib/providers/googlebooks";
import { mapOpenLibraryDoc } from "@/lib/providers/openlibrary";

describe("Open Library results", () => {
  it("maps a full doc", () => {
    expect(
      mapOpenLibraryDoc({
        key: "/works/OL1168083W",
        title: "Nineteen Eighty-Four",
        author_name: ["George Orwell"],
        first_publish_year: 1949,
        number_of_pages_median: 328.5,
        cover_i: 9267242,
        subject: ["Dystopias", "Fiction", "Totalitarianism"],
        language: ["eng", "spa"],
      }),
    ).toEqual({
      key: "ol:/works/OL1168083W",
      source: "Open Library",
      title: "Nineteen Eighty-Four",
      authors: ["George Orwell"],
      year: "1949",
      pages: 329,
      coverUrl: "https://covers.openlibrary.org/b/id/9267242-L.jpg",
      subjects: ["Dystopias", "Fiction", "Totalitarianism"],
    });
  });

  it("maps a sparse doc", () => {
    expect(mapOpenLibraryDoc({ key: "/works/OL1W", title: " Untitled " })).toEqual({
      key: "ol:/works/OL1W",
      source: "Open Library",
      title: "Untitled",
      authors: [],
      year: undefined,
      pages: undefined,
      coverUrl: undefined,
      subjects: [],
    });
  });

  it("drops docs without a title or key, and ignores junk fields", () => {
    expect(mapOpenLibraryDoc({ key: "/works/OL1W" })).toBeUndefined();
    expect(mapOpenLibraryDoc({ title: "No key" })).toBeUndefined();
    expect(mapOpenLibraryDoc(null)).toBeUndefined();
    const odd = mapOpenLibraryDoc({ key: "/works/OL2W", title: "Odd", author_name: "George Orwell", cover_i: -1, number_of_pages_median: 0, subject: [1, "", "Real"] });
    expect(odd).toMatchObject({ authors: [], coverUrl: undefined, pages: undefined, subjects: ["Real"] });
  });
});

describe("Google Books results", () => {
  it("maps a volume and upgrades the thumbnail to https", () => {
    expect(
      mapGoogleVolume({
        id: "kotPYEqx7kMC",
        volumeInfo: { title: "1984", subtitle: "A Novel", authors: ["George Orwell"], publishedDate: "1983-10-17", pageCount: 648, categories: ["Fiction"], imageLinks: { thumbnail: "http://books.google.com/books/content?id=kotPYEqx7kMC&edge=curl" } },
      }),
    ).toEqual({
      key: "gb:kotPYEqx7kMC",
      source: "Google Books",
      title: "1984: A Novel",
      authors: ["George Orwell"],
      year: "1983",
      pages: 648,
      coverUrl: "https://books.google.com/books/content?id=kotPYEqx7kMC",
      subjects: ["Fiction"],
    });
  });

  it("drops volumes without a title", () => {
    expect(mapGoogleVolume({ id: "x", volumeInfo: {} })).toBeUndefined();
    expect(mapGoogleVolume(undefined)).toBeUndefined();
  });
});
