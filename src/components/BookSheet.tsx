"use client";

import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { PublicBook } from "@/lib/types";
import { FinishedStamp } from "./Bits";
import { DueSlip } from "./DueSlip";
import { IndexCard } from "./IndexCard";

/**
 * One card pulled from the drawer: its front, and its date-due slip turned over beside it. `children` go inside
 * the slip (the owner’s progress logger).
 */
export function BookSheet({ book, onClose, children }: { book: PublicBook; onClose: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Whatever opened the sheet (a card); focus goes back there when it closes.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));

  // The stamp comes down when the book turns Done while the sheet is open.
  const [seenStatus, setSeenStatus] = useState(book.status);
  const [thump, setThump] = useState(false);
  if (seenStatus !== book.status) {
    setSeenStatus(book.status);
    setThump(book.status === "Done");
  }

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      // The dialog unmounts instead of closing, so the browser doesn’t restore focus itself.
      opener?.focus({ preventScroll: true });
    };
  }, [opener]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      className="sheet fixed inset-0 h-dvh w-full items-end justify-center open:flex sm:items-center sm:p-6"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The browser may still close it (Esc pressed twice); keep React in step.
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-md border border-edge bg-ground sm:max-h-[88dvh] sm:max-w-4xl sm:rounded-md">
        <div className="flex items-center justify-between gap-4 py-1 pr-1 pl-4 sm:pl-6">
          <p className="text-[13px] text-soft">Pulled from the drawer</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 cursor-pointer items-center justify-center rounded-sm text-soft hover:text-ink">
            <XIcon size={20} aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
          <IndexCard book={book} heading="h2" titleId="sheet-title" />
          <div className="slip-turn">
            <DueSlip book={book} stamp={thump ? <FinishedStamp className="stamp-thump" /> : undefined}>
              {children}
            </DueSlip>
          </div>
        </div>
      </div>
    </dialog>
  );
}
