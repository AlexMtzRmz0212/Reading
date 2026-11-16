# Reading List: design decisions

Source of truth for the look. Change this file first, then the code.

## The idea

On this site, **each book's Notion row becomes a 3×5 library catalog card**, and the page is the open drawer on a
reading-room desk. The public page is the drawer. The private pages are the librarian's desk.

The competitor test: Cinetech is a wall of posters, Runtime is a race bib. Neither can file a book under
`ORWELL, George`, number it, and stamp the date it came back.

One live thing: the card turns over. Opening a card shows its date-due slip (started, completed, pages read), and
for the owner that slip is where progress gets logged and the stamp lands.

## What the data really looks like (2026-11-15)

92 rows. Almost all have only rank, author, title and original title. Genre, Year and Pages are empty on most rows,
score on all but one, and there are no covers yet. Six ranks are shared (01, 07, 45, 60) and 75 is unused.

So the card is designed to look complete with three lines on it. Year, pages, subjects, score, cover and progress
are extras that appear when present and leave no hole when absent.

## Palette

The reading room, not the cream-and-terracotta page. Light mode is the desk in daylight: cards on a green-grey
blotter under an oak drawer front. Dark mode is the same drawer at night.

| Role | Light | Dark | Used for |
|---|---|---|---|
| `ground` | `#dde2d6` blotter | `#191512` wood | page |
| `card` | `#f8f3e3` buff stock | `#2a2620` | cards, slips, fields, dialog |
| `edge` | `#d9cfb2` | `#40392e` | card edge, one tone step, never a shadow |
| `manila` | `#ecd9a4` | `#4a3f27` | guide-card tabs |
| `ink` | `#1d1b17` | `#ece4d0` | all running text |
| `soft` | `#595348` | `#b5ab95` | secondary typed lines |
| `rule` | `#b9cddc` | `#3d4a57` | the card's blue ruled lines (decoration only) |
| `red` | `#b3372b` | `#ea7b6c` | the card's top rule, the ON LOAN stamp, errors |
| `stamp` | `#43388a` | `#a99cf5` | date stamps, FINISHED, links, focus ring, the one filled button |
| `brass` | `#a8842f` | `#d3ac55` | label holder, rod hole ring |
| `oak` | `#6f4a2a` | `#33251a` | drawer front (header band) |
| `pencil` | `#5f6368` | `#a9aeb5` | pencil notes and the progress tally |

Rules:
- Red is never a button or a link. It is the ruled line and one stamp. That keeps it from reading as a terracotta accent.
- Stamp violet is the only interactive colour. It is real date-stamp ink, which is why a violet is allowed here.
- Contrast: every text pair is AA or better in both modes (checked with `scripts/contrast.mjs`). `rule` and `brass`
  never carry text.
- No gradients except the ruled lines, which are drawn with a repeating background because they are lines on paper.
- No shadows on cards at rest. The dialog is the only thing that floats.

## Type

| Face | Role |
|---|---|
| **Courier Prime** (400, 700, italic) | Everything typed: call numbers, authors, fields, buttons, body. The card was typed on a library typewriter. |
| **Gentium Book Plus** (400, 700, italic) | Titles, original titles, the page title, the wordmark. A bookish old-style face built for scholarship in many scripts: it covers the polytonic Greek and Cyrillic that a fifth of the original titles need (Περὶ Ψυχῆς, Что такое искусство?). Old Standard TT was the first pick but has no Greek on Google Fonts. |
| **Caveat** (500) | Pencil only: page progress and the owner's annotations. Never for navigation or labels. |

Scale: 13 / 15 (body) / 21 (card title) / 24 (section headings) / 32 (page title, 26 on phones). Card text sits on a
24px line so it rides the ruled lines.

Monospace, the `№ 07` call number, ruled lines and uppercase stamps are normally generated-page tells. Here they
are the artefact itself, and they appear only where the real object has them: on cards, slips, tabs and stamps.
Navigation, headings and buttons stay in sentence case.

## Card anatomy (front)

```
┌────────────────────────────────────────────┐
│ № 07                              ┌─────┐  │  call number = Top rank ("—" when uncatalogued)
│━━━━━━━━━━━━ red rule ━━━━━━━━━━━━ │cover│  │  cover: optional, small, tilted 2°, never the hero
│ ORWELL, George                    └─────┘  │  author in catalog form, typed, bold
│   Nineteen eighty-four                     │  title, Gentium Book Plus 21px, hanging indent
│   Nineteen Eighty-Four                     │  original title, italic, only when different
│   1949. 328 p.                             │  imprint line, only what exists
│   1. Dystopia. 2. Fiction.                 │  genres as subject tracings
│   p. 132 of 638                            │  pencil, only while on loan
│ 8.5/10            ( o )          [ON LOAN] │  score · rod hole · status stamp
└────────────────────────────────────────────┘
```

- Ratio 5:3 minimum; it grows when a title wraps.
- Grid cards stamp only `ON LOAN` and `FINISHED`. Eighty `AWAITING` stamps would be noise; that stamp lives on the slip.
- No cover: nothing is drawn. The typed card is the placeholder.

## Back of the card: the date-due slip (detail sheet)

Native `<dialog>`. Card on the left, slip on the right (stacked on phones), so nothing needs a click to be read.

- Two columns, `Started` and `Completed`, with the dates rubber-stamped (`MAY 30 2025`, stamp violet, slightly off-square).
- Status stamp: `FINISHED`, `ON LOAN`, `AWAITING`.
- Pages read as a pencil bar with a Caveat note: `p. 132 of 638, 21%`.
- Fine slip (easter egg): `Overdue: 0 days. Fine: $0.00`.
- Owners get the progress logger under the slip.

## Layout

```
┌ oak drawer front ─────────────────────────────────────────────┐
│ [brass holder: Reading list]      Catalog  Desk  Add  Ranks  🔒 │
└───────────────────────────────────────────────────────────────┘
  Alex's reading list                      ← h1, Gentium Book Plus 32
  92 books in the drawer. 7 on loan, 6 finished.

  On loan now          ← narrow date-due slips, one per book in progress
  [slip][slip][slip][slip] →

  [search……………] [author ▾] [genre ▾] [status ▾]      Sort [rank ▾]
  ╭01–10╮╭11–20╮╭21–30╮ …                 ← sticky guide tabs, anchors
  ┌card┐ ┌card┐ ┌card┐
  ┌card┐ ┌card┐ ┌card┐
```

- One left edge, equal outer margins (16px phone, 24px up), max width 72rem.
- Grid: 1 column under 640px, 2 to 1024px, 3 above.
- Tabs follow the sort: rank → tens (`01–10`), author and title → letters, recently finished → years, pages → none.
- Left-aligned everywhere. Nothing centred except the rod hole.

## Motion

All inside `prefers-reduced-motion: no-preference`. Transform and opacity only.

| Move | When | Spec |
|---|---|---|
| Cards settle | first load only | first 12 cards rise 10px and fade in, 35ms stagger, 260ms ease-out |
| Sheet opens | click a card | dialog scales from 0.97 at the card's position, 200ms; closes faster (140ms) |
| Slip turns over | sheet opens | slip rotates in on its left edge (from 35°), 240ms, 60ms after the card |
| Stamp thump | a book is marked Done | scale 1.45→1, rotate −12°→−5°, 200ms ease-out, then a 260ms ink bloom |
| Press | buttons, tabs, cards | scale 0.97 / translateY 1px, 100ms |

Everything uses one strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`): nothing eases in, so the first frame always moves. The
sheet has no exit animation (it closes at once). With reduced motion the sheet and the stamp only fade.

No scroll-triggered fades, no hover animation on every card beyond a 2px lift on fine pointers.

## Accessibility

Skip link, visible focus ring (2px stamp violet, 2px offset), native `<dialog>` with focus return, `aria-live`
result count, tabs are plain anchors (keyboard works without script), 44px touch targets, text never sits on a
texture that fails contrast (ruled lines are 1px and below the baseline).

## Copy

Plain and in the librarian's voice. "On loan" for in progress, "Awaiting" for not started, "Uncatalogued" for
unranked. Buttons say what they do: "Log page", "Mark finished", "Add to catalog", "Apply 2 changes".
