"use client";

import { useSyncExternalStore } from "react";

function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 10_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverMinute = () => undefined;

export function useOrderExpiry(durationMillis: number, invalid: boolean) {
  const now = useSyncExternalStore(subscribeToClock, currentMinute, serverMinute);
  const timestamp = now === undefined ? NaN : now + durationMillis;
  const date = new Date(timestamp);
  const description = "The deadline after which remaining trades can no longer execute. Before submission, this is a preview; the final deadline is set when you submit the order.";

  if (now === undefined || invalid || durationMillis <= 0 || !Number.isFinite(date.getTime())) {
    return { label: "—", tooltip: description, dateTime: undefined };
  }

  const today = new Date(now);
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  const day = sameDay ? "Today" : new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(date);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    label: `${day}, ${time}`,
    tooltip: `${fullDate} (${timezone}). ${description}`,
    dateTime: date.toISOString(),
  };
}
