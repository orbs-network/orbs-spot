/** Confirm a mined approval is visible to RPC reads without issuing another transaction. */
export async function confirmAllowance(
  hasAllowance: () => Promise<boolean>,
  { message, attempts = 4, delayMillis = 500, signal }: {
    message: string;
    attempts?: number;
    delayMillis?: number;
    signal?: AbortSignal;
  },
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();
    const sufficient = await hasAllowance();
    signal?.throwIfAborted();
    if (sufficient) return;
    if (attempt < attempts - 1 && delayMillis > 0) {
      await new Promise<void>((resolve, reject) => {
        const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
        const timer = setTimeout(finish, delayMillis);
        const abort = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          reject(signal?.reason);
        };
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
  }
  throw new Error(message);
}
