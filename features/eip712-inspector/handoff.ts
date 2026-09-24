import type { OrderContext } from "./inspect";

export const INSPECTOR_PATH = "/developers/eip712";
const PREFIX = "eip712-inspector:v1:";
const MAX_AGE = 5 * 60_000;
export type InspectorDraft = {
  typedData: unknown;
  context?: OrderContext;
};
export const stringify = (value: unknown): string =>
  JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );

/** One-time local handoff. Order data never appears in the URL. */
export function saveDraft(draft: InspectorDraft): string {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX)) continue;
    try {
      if (
        Date.now() - JSON.parse(localStorage.getItem(key) ?? "{}").createdAt <
        MAX_AGE
      )
        continue;
    } catch {
      /* Remove corrupt handoffs as well. */
    }
    localStorage.removeItem(key);
  }
  const id = crypto.randomUUID();
  localStorage.setItem(
    PREFIX + id,
    stringify({ createdAt: Date.now(), draft }),
  );
  // Also expire an unopened draft while this tab remains alive.
  window.setTimeout(() => localStorage.removeItem(PREFIX + id), MAX_AGE);
  return `${INSPECTOR_PATH}?draft=${id}`;
}
export function takeDraft(id: string): InspectorDraft {
  const key = PREFIX + id;
  const raw = localStorage.getItem(key);
  localStorage.removeItem(key);
  if (!raw)
    throw new Error(
      "This order snapshot has already been opened or is no longer available. Open Preview order from the order flow again.",
    );
  const saved = JSON.parse(raw);
  if (!saved.createdAt || Date.now() - saved.createdAt > MAX_AGE)
    throw new Error(
      "This order snapshot expired. Open a fresh snapshot from the order flow.",
    );
  return saved.draft as InspectorDraft;
}
