# Reading List

Alex's reading list as a library card catalog. The public page is the drawer of index cards; the private pages
(password) are the librarian's desk: log reading progress, add a book from search, edit ranks and scores.

Source of truth: the Notion database **Reading List**. Design decisions live in [DESIGN.md](DESIGN.md).

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. Deployed on Vercel.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in:

   | Variable | What it is |
   |---|---|
   | `NOTION_TOKEN` | Internal integration secret from https://www.notion.so/profile/integrations |
   | `READING_DATABASE_ID` | Id of the Reading List database (already in `.env.example`) |
   | `APP_PASSWORD` | Password for the owner pages. Make it long |
   | `SESSION_SECRET` | Any long random string; signs the session cookie |
   | `TIME_ZONE` | Optional, e.g. `America/Mexico_City`, so "today" is your day |
   | `GOOGLE_BOOKS_API_KEY` | Optional second search source on the Add page |

3. In Notion, open the Reading List database, `…` menu, **Connections**, and add your integration.
4. `npm run dev` (or double-click `DEV.bat`) and open http://localhost:3000

A missing variable or an unconnected database shows a setup message instead of a crash.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | everyone | The catalog: search, filters, sorts, guide tabs, books on loan |
| `/book/[slug]` | everyone | One card and its date-due slip |
| `/login` | everyone | Owner sign in |
| `/desk` | owner | Log pages, mark finished, undo |
| `/add` | owner | Search Open Library, check for duplicates, add a book |
| `/ranks` | owner | Reorder (drag, arrows, or type a number), edit scores, review the diff, apply |

Without `APP_PASSWORD` the gate is open in development and always closed in production.

## Try it without touching Notion

```bash
npm run mock:notion
```

```bash
npm run dev:mock
```

The first serves a stand-in Notion API on port 4010 (rows from `scripts/mock-books.json`) and prints every write.
The second runs the app against it; the owner password is in the `dev:mock` script in `package.json`.
`NOTION_BASE_URL` is ignored in production builds.

## Checks

```bash
npm test
```

```bash
npm run lint
```

```bash
node scripts/contrast.mjs
```

## Deploy (Vercel)

1. Import the repository in Vercel.
2. Add the environment variables above (Production and Preview).
3. Deploy. The catalog re-reads Notion at most every 15 minutes; owner actions refresh it at once.

Notes:
- Notion allows about 3 requests per second, so writes go 3 at a time. A large rank reorder is applied in batches
  of 15 rows per request, driven by the browser, so no request outlives a serverless function.
- The first "Apply" on `/ranks` rewrites most ranks: today four numbers are shared by two books and 75 is unused.
  The review step lists every change before anything is written.
- The login throttle is per server instance (best effort on serverless). Use a long password.
