/** @type {object | undefined} */
let active;
/** @type {Set<() => void>} */
const listeners = new Set();
const publish = () => { for (const listener of listeners) listener(); };

/** Serialize wallet prompts; signed submissions can finish independently. */
/** @param {object} [owner] */
export function acquireSubmissionLock(owner = {}) {
  if (active) throw new Error("Confirm the pending wallet request before starting another submission.");
  const lock = { owner };
  active = lock;
  publish();
  return () => {
    if (active !== lock) return;
    active = undefined;
    publish();
  };
}

export const isSubmissionBusy = () => active !== undefined;
/** @param {() => void} listener */
export const subscribeSubmissionLock = (listener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
