import { toast, type ExternalToast } from "sonner";

const REJECTION_CODES = new Set([4001, "4001", "ACTION_REJECTED"]);
const REJECTION_TOAST_ID = "transaction-rejected";

function getRejectionToastId(id?: ExternalToast["id"]) {
  return id === undefined ? REJECTION_TOAST_ID : `${String(id)}-rejected`;
}

function getErrorFields(error: unknown) {
  if (!error || typeof error !== "object") {
    return [];
  }

  const record = error as Record<string, unknown>;
  return [
    record.code,
    record.name,
    record.message,
    record.shortMessage,
    record.details,
    record.reason,
  ];
}

export function isUserRejectedError(error: unknown): boolean {
  if (!error) return false;

  for (const field of getErrorFields(error)) {
    if (REJECTION_CODES.has(field as string | number)) {
      return true;
    }

    if (typeof field !== "string") {
      continue;
    }

    const value = field.toLowerCase();
    if (
      value.includes("rejected") ||
      value.includes("denied") ||
      value.includes("declined") ||
      value.includes("user rejected") ||
      value.includes("user denied") ||
      value.includes("user declined") ||
      value.includes("request rejected") ||
      value.includes("transaction rejected") ||
      value.includes("signature rejected") ||
      value.includes("action_rejected")
    ) {
      return true;
    }
  }

  const cause = (error as { cause?: unknown })?.cause;
  return cause ? isUserRejectedError(cause) : false;
}

/** Wallet cancellation returns to review without a notification. */
export function dismissTransactionRejectedToast(options: ExternalToast = {}) {
  if (options.id !== undefined) toast.dismiss(options.id);
  toast.dismiss(getRejectionToastId(options.id));
}
