import { toast, type ExternalToast } from "sonner";

export { isUserRejectedError } from "./spot/wallet-errors.ts";
const REJECTION_TOAST_ID = "transaction-rejected";

function getRejectionToastId(id?: ExternalToast["id"]) {
  return id === undefined ? REJECTION_TOAST_ID : `${String(id)}-rejected`;
}

/** Wallet cancellation returns to review without a notification. */
export function dismissTransactionRejectedToast(options: ExternalToast = {}) {
  if (options.id !== undefined) toast.dismiss(options.id);
  toast.dismiss(getRejectionToastId(options.id));
}
