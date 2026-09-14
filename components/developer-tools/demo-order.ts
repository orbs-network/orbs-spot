import { InputErrors, type CalculatedOrderForm } from "@orbs-network/spot-ui";

export type DeveloperExecutionMode = "demo" | "live";
// Example bytes only; never signed or submitted.
export const DEMO_SIGNATURE = `0x${"11".repeat(32)}${"22".repeat(32)}1b` as const;
export const DEMO_ACCOUNT = "0x5555555555555555555555555555555555555555";

/** Preserve every SDK validation except the demo's assumed token balance. */
export function getDemoOrderForm(form: CalculatedOrderForm): CalculatedOrderForm {
  const all = form.errors.all.filter((error) => error.type !== InputErrors.INSUFFICIENT_BALANCE);
  return {
    ...form,
    errors: { ...form.errors, all, primary: all[0], balance: undefined },
    canSubmit: form.isReady && all.length === 0,
  };
}

export const DEMO_STEP_COPY = {
  flow: "Live token data and market inputs populate this SDK example. Edit the calculation inputs, then start the demo. Execution is simulated; this does not verify on-chain execution or guarantee a fill.",
  check: "Simulated allowance: 0. The demo assumes sufficient token and gas balances and zero allowance to demonstrate approval. It does not read or change your wallet allowance.",
  wrap: "Simulated wrapping. Review the native-token deposit code; continuing sends no transaction and spends no gas.",
  approve: "Simulated approval. Review the token and spender; continuing grants no spending permission and sends no transaction.",
  sign: "Simulated signing. This is the calculated EIP-712 payload, but no wallet opens and no valid signature is generated.",
  submit: "Simulated submission. The signature is an intentionally invalid demo placeholder. Continuing shows a local example result; no request is sent to Orders Sink.",
  success: "This is a local demo result, not a server response. No order was created, no funds moved, and nothing was added to order history. Live execution and fills have not been verified.",
};
