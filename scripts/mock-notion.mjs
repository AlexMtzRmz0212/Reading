// A stand-in for the Notion API, for trying the app (and its writes) without touching the real database.
//
//   node scripts/mock-notion.mjs            # listens on http://localhost:4010
//   NOTION_BASE_URL=http://localhost:4010 NOTION_TOKEN=mock READING_DATABASE_ID=mock npm run dev
//
// It serves the handful of endpoints the app uses, holds the rows in memory (seeded from mock-books.json, a
// snapshot of the real list's shape) and prints every write. NOTION_BASE_URL is ignored in production builds.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_NOTION_PORT ?? 4010);
const seed = JSON.parse(readFileSync(new URL("./mock-books.json", import.meta.url), "utf8"));

const rich = (s) => (s ? [{ type: "text", plain_text: s, text: { content: s } }] : []);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const external = (url) => (url ? { type: "external", external: { url } } : null);

const pages = seed.map((b, i) => ({
  object: "page",
  id: id(i + 1),
  cover: external(b.cover),
  icon: external(b.cover),
  properties: {
    Name: { type: "title", title: rich(b.name) },
    "Original Name": { rich_text: rich(b.orig === "=" ? b.name : b.orig) },
    Author: { select: b.author ? { name: b.author } : null },
    Genre: { multi_select: (b.genres ?? []).map((name) => ({ name })) },
    Year: { rich_text: rich(b.year) },
    Pages: { number: b.pages ?? null },
    "Current page": { number: b.cur ?? null },
    "Progress percentage": { formula: { type: "number", number: b.pages && b.cur != null ? b.cur / b.pages : null } },
    Status: { status: { name: b.status ?? "Not started" } },
    Started: { date: b.started ? { start: b.started } : null },
    Completed: { date: b.completed ? { start: b.completed } : null },
    Relevancy: { select: b.top ? { name: b.top } : null },
    "Alex Relevance/Score": { number: b.score ?? null },
  },
}));

const optionsOf = (prop, pick) => [...new Set(pages.flatMap((p) => pick(p.properties[prop])).filter(Boolean))].sort().map((name) => ({ name }));
const GENRES = ["War", "Fantasy", "Drama", "Horror", "Mystery", "Thriller", "Science fiction", "Self help", "History", "Psychological", "Dystopia", "Fiction", "Historical Fiction"];

const schema = () => ({
  object: "data_source",
  id: "mock-data-source",
  properties: {
    Name: { type: "title", title: {} },
    "Original Name": { type: "rich_text", rich_text: {} },
    Author: { type: "select", select: { options: optionsOf("Author", (p) => [p.select?.name]) } },
    Genre: { type: "multi_select", multi_select: { options: GENRES.map((name) => ({ name })) } },
    Year: { type: "rich_text", rich_text: {} },
    Pages: { type: "number", number: {} },
    "Current page": { type: "number", number: {} },
    "Progress percentage": { type: "formula", formula: {} },
    Status: { type: "status", status: { options: [{ name: "Not started" }, { name: "In progress" }, { name: "Done" }] } },
    Started: { type: "date", date: {} },
    Completed: { type: "date", date: {} },
    Relevancy: { type: "select", select: { options: optionsOf("Relevancy", (p) => [p.select?.name]) } },
    "Alex Relevance/Score": { type: "number", number: {} },
  },
});

/** A write payload stored the way a read returns it. */
function store(page, body) {
  for (const [name, value] of Object.entries(body.properties ?? {})) {
    if (!(name in page.properties)) throw Object.assign(new Error(`${name} is not a property that exists.`), { status: 400 });
    if (name === "Progress percentage") throw Object.assign(new Error("Progress percentage is a formula and cannot be written."), { status: 400 });
    const text = (list) => rich((list ?? []).map((t) => t.text?.content ?? "").join(""));
    if (value.title) page.properties[name] = { type: "title", title: text(value.title) };
    else if (value.rich_text) page.properties[name] = { rich_text: text(value.rich_text) };
    else page.properties[name] = value;
  }
  if ("cover" in body) page.cover = body.cover;
  if ("icon" in body) page.icon = body.icon;
  return page;
}

const describe = (properties = {}) =>
  Object.entries(properties)
    .map(([k, v]) => `${k}=${JSON.stringify(v.number ?? v.status?.name ?? v.select?.name ?? v.date?.start ?? v.title?.[0]?.text?.content ?? v.rich_text?.[0]?.text?.content ?? v.multi_select?.map((o) => o.name) ?? null)}`)
    .join("  ");

createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const path = new URL(req.url, "http://mock").pathname.replace(/^\/v1/, "");
      const body = raw ? JSON.parse(raw) : {};
      const pageId = path.match(/^\/pages\/([^/]+)$/)?.[1];

      if (req.method === "GET" && path.startsWith("/databases/")) return send(200, { object: "database", id: "mock", data_sources: [{ id: "mock-data-source", name: "Reading List" }] });
      if (req.method === "GET" && path.startsWith("/data_sources/")) return send(200, schema());
      if (req.method === "POST" && /^\/data_sources\/[^/]+\/query$/.test(path)) {
        const start = Number(body.start_cursor ?? 0);
        const size = Math.min(100, body.page_size ?? 100);
        const more = start + size < pages.length;
        return send(200, { object: "list", results: pages.slice(start, start + size), has_more: more, next_cursor: more ? String(start + size) : null });
      }
      if (req.method === "PATCH" && pageId) {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return send(404, { object: "error", status: 404, code: "object_not_found", message: "Could not find page." });
        store(page, body);
        console.log(`UPDATE  ${page.properties.Name.title[0]?.plain_text}  ${describe(body.properties)}`);
        return send(200, page);
      }
      if (req.method === "POST" && path === "/pages") {
        const page = store({ object: "page", id: id(pages.length + 1), cover: null, icon: null, properties: structuredClone(pages[0].properties) }, { properties: Object.fromEntries(Object.keys(pages[0].properties).filter((k) => k !== "Progress percentage").map((k) => [k, emptyOf(pages[0].properties[k])])) });
        store(page, body);
        pages.push(page);
        console.log(`CREATE  ${describe(body.properties)}  cover=${body.cover?.external?.url ?? null}  icon=${body.icon?.external?.url ?? null}`);
        return send(200, page);
      }
      send(404, { object: "error", status: 404, code: "not_found", message: `Mock has no ${req.method} ${path}` });
    } catch (error) {
      send(error.status ?? 500, { object: "error", status: error.status ?? 500, code: "validation_error", message: error.message });
    }
  });
}).listen(PORT, () => console.log(`Mock Notion on http://localhost:${PORT} with ${pages.length} rows`));

function emptyOf(prop) {
  if ("title" in prop) return { title: [] };
  if ("rich_text" in prop) return { rich_text: [] };
  if ("multi_select" in prop) return { multi_select: [] };
  if ("select" in prop) return { select: null };
  if ("status" in prop) return { status: { name: "Not started" } };
  if ("date" in prop) return { date: null };
  return { number: null };
}
