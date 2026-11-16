import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkPassword, createSession, isPublicPath, sameOrigin, verifySession } from "@/lib/auth";
import { toPublicBook, type Book } from "@/lib/types";

describe("public catalog", () => {
  it("only the read-only pages are open to visitors", () => {
    for (const p of ["/", "/login", "/api/login", "/api/logout", "/api/me", "/book/1984-abcd1234"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/desk", "/add", "/ranks", "/api/books", "/api/books/abc", "/api/ranks", "/api/search", "/api/add", "/books", "/bookshelf"]) expect(isPublicPath(p)).toBe(false);
  });

  it("strips the Notion id from books", () => {
    const book: Book = { id: "0c43d891-0055-4d43-a383-ee61308e9588", slug: "el-mundo-de-sofia-0c43d891", title: "El Mundo de Sofía", genres: [], status: "In progress", rank: 5, currentPage: 132, pages: 638 };
    const pub = toPublicBook(book);
    expect(pub).not.toHaveProperty("id");
    expect(JSON.stringify(pub)).not.toContain("0c43d891-0055");
    expect(pub.title).toBe("El Mundo de Sofía");
  });
});

describe("session cookie", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.APP_PASSWORD = "open sesame";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("signs and verifies", async () => {
    const { value, maxAge } = await createSession();
    expect(maxAge).toBe(60 * 60 * 24 * 30);
    expect(await verifySession(value)).toBe(true);
  });

  it("rejects a tampered, expired, malformed or missing cookie", async () => {
    const now = Date.now();
    const { value } = await createSession(now);
    const [exp, sig] = value.split(".");
    expect(await verifySession(`${Number(exp) + 1000}.${sig}`)).toBe(false);
    expect(await verifySession(`${exp}.${sig.slice(0, -1)}0`.replace(sig, "0".repeat(sig.length)))).toBe(false);
    expect(await verifySession(value, now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(await verifySession(`${value}.extra`)).toBe(false);
    expect(await verifySession("")).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
  });

  it("a cookie signed with another secret fails", async () => {
    const { value } = await createSession();
    process.env.SESSION_SECRET = "another-secret";
    expect(await verifySession(value)).toBe(false);
  });

  it("checks the password", async () => {
    expect(await checkPassword("open sesame")).toBe(true);
    expect(await checkPassword("open sesame ")).toBe(false);
    delete process.env.APP_PASSWORD;
    expect(await checkPassword("")).toBe(false);
  });
});

describe("same-origin check", () => {
  const req = (method: string, headers: Record<string, string>) => ({ method, headers: new Headers(headers), nextUrl: { host: "reading.example" } });

  it("lets reads and same-site writes through", () => {
    expect(sameOrigin(req("GET", { origin: "https://evil.example", host: "reading.example" }))).toBe(true);
    expect(sameOrigin(req("PATCH", { origin: "https://reading.example", host: "reading.example" }))).toBe(true);
    expect(sameOrigin(req("POST", { host: "reading.example" }))).toBe(true);
  });

  it("blocks writes from another site", () => {
    expect(sameOrigin(req("POST", { origin: "https://evil.example", host: "reading.example" }))).toBe(false);
    expect(sameOrigin(req("PATCH", { origin: "null", host: "reading.example" }))).toBe(false);
  });
});
