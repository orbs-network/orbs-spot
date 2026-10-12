import { transactionErrorMessage } from "@/lib/transaction-error";

export function TransactionError({ error }: { error?: { message?: string; code?: string | number } }) {
  return <div className="flex w-full flex-col gap-3 text-left">
    <p className="text-sm leading-relaxed text-muted-foreground">{transactionErrorMessage(error?.message)}</p>
    {(error?.message || error?.code) && <details className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium">Technical details</summary>
      <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{error.code ? `${error.code}: ` : ""}{error.message}</p>
    </details>}
  </div>;
}
