import type { Metadata, Viewport } from "next";
import { Caveat, Courier_Prime, Gentium_Book_Plus } from "next/font/google";
import Link from "next/link";
import { preconnect } from "react-dom";
import { OwnerNav } from "@/components/OwnerNav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reading List", template: "%s · Reading List" },
  description: "Alex’s reading list as a library card catalog: every book ranked, filed and date-stamped",
};
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6f4a2a" },
    { media: "(prefers-color-scheme: dark)", color: "#33251a" },
  ],
};

// Courier Prime for everything typed on a card; Gentium Book Plus for titles (it covers the Greek and Cyrillic the
// original titles need); Caveat only for pencil notes.
const typed = Courier_Prime({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-courier" });
const serif = Gentium_Book_Plus({ subsets: ["latin", "latin-ext", "greek", "greek-ext", "cyrillic"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-gentium" });
const pencil = Caveat({ subsets: ["latin", "latin-ext"], weight: ["500"], variable: "--font-caveat" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Covers are served by Open Library.
  preconnect("https://covers.openlibrary.org");
  return (
    <html lang="en" className={`${typed.variable} ${serif.variable} ${pencil.variable}`}>
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-stamp focus:px-3 focus:py-2 focus:font-bold focus:text-on-stamp">
          Skip to content
        </a>
        {/* The drawer front: oak, with the label in its brass holder. */}
        <header className="on-oak bg-oak text-on-oak">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-3">
            <Link href="/" className="my-1 rounded-[3px] border-2 border-brass bg-card px-3 pt-1 pb-0.5 font-serif text-[22px] leading-tight font-bold text-ink" translate="no">
              Reading List
            </Link>
            <OwnerNav />
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-[13px] text-soft sm:px-6">
          Kept in Notion. Book search and covers from{" "}
          <a href="https://openlibrary.org" className="underline underline-offset-2 hover:text-ink" rel="noreferrer" translate="no">
            Open Library
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
