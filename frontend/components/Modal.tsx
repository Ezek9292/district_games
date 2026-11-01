"use client";

import type { ReactNode } from "react";

export function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: ReactNode }) {
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")}>{children}</div>
    </div>
  );
}
