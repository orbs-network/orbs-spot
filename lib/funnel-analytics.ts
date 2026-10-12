/** No transport is installed by default. Connect the approved analytics provider
 * here after its consent policy is configured. Never pass wallet/amount data. */
export type FunnelEvent = {
  name: "wallet_connect_requested" | "review_opened" | "submit_requested" | "wallet_step_requested" | "price_update_shown" | "submission_succeeded" | "submission_failed";
  product: "swap" | "advanced";
  step?: "wrap" | "approve" | "sign";
};

let sink: ((event: FunnelEvent) => void) | undefined;
export function configureFunnelAnalytics(next?: (event: FunnelEvent) => void) { sink = next; }
export function trackFunnel(event: FunnelEvent) {
  try { sink?.({ name: event.name, product: event.product, ...(event.step ? { step: event.step } : {}) }); }
  catch { /* Analytics must never interrupt trading. */ }
}
