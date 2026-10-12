"use client";

import type { KeyboardEvent } from "react";

type View = "open" | "history";
const VIEWS = ["open", "history"] as const;

export function HistoryViewTabs({ value, onChange }: { value: View; onChange: (value: View) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = VIEWS.indexOf(value);
    const next = VIEWS[event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
    onChange(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus();
  };

  return <div data-history-view-tabs role="tablist" aria-label="Order views" className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
    {VIEWS.map(view => <button key={view} id={`history-view-${view}`} data-view={view} role="tab" type="button" aria-selected={value === view} aria-controls="history-order-results" tabIndex={value === view ? 0 : -1} onKeyDown={onKeyDown} onClick={() => onChange(view)} className="min-h-9 rounded-xl border-0 bg-transparent px-3 text-sm text-muted-foreground aria-selected:bg-primary aria-selected:font-semibold aria-selected:text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2">
      {view === "open" ? "Open" : "History"}
    </button>)}
  </div>;
}
