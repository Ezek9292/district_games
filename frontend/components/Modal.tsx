"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A dialog over the page: closes on Escape or a tap outside, and takes focus while open. */
export function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Respect an autoFocus field inside; otherwise focus the dialog itself.
    if (box.current && !box.current.contains(document.activeElement)) box.current.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only the top dialog closes (a player profile can open over the line-ups).
      const open = document.querySelectorAll(".modal");
      if (open[open.length - 1] === box.current) close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
