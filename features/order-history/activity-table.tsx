"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";
import styles from "./activity-list.module.css";

/** A one-time mobile hint, independent of the virtual feed's renders. */
export function ActivityTable({ children }: { children: ReactNode }) {
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const [showHint, setShowHint] = useState(false);
  const updateHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (element.scrollLeft > 0) hasScrolled.current = true;
    setShowHint(!hasScrolled.current && element.scrollWidth > element.clientWidth);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateHint);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [updateHint]);

  const scrollRight = () => {
    const element = scrollRef.current;
    if (!element) return;
    const frozenWidth = element.querySelector<HTMLElement>("[data-column='placed']")?.offsetWidth ?? 0;
    element.focus({ preventScroll: true });
    element.scrollBy({
      left: Math.max(120, element.clientWidth - frozenWidth),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  return <div className={styles.tableFrame}>
    <div ref={scrollRef} id={id} className={styles.tableScroll} data-activity-scroll
      role="region" aria-label="Order table, scroll horizontally for more details" tabIndex={0} onScroll={updateHint}>
      <div className={styles.table}>{children}</div>
    </div>
    {showHint && <div className={styles.scrollControls} data-activity-scroll-controls>
      <button data-icon-button type="button" aria-label="Scroll order columns right" aria-controls={id}
        onClick={scrollRight}><ArrowRightIcon aria-hidden="true" /></button>
    </div>}
  </div>;
}
