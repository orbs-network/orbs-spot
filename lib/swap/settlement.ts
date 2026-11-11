import { OrderStatus, type Order, type SpotClient } from "@orbs-network/spot-ui";

/** Stopping local tracking never cancels an accepted order. */
export class OrderSettlementError extends Error {
  readonly name = "OrderSettlementError";

  constructor(
    message: string,
    readonly reason: "cancelled" | "expired" | "unconfirmed" | "aborted",
    readonly orderId: string,
  ) {
    super(message);
  }
}

export interface WaitForOrderParams {
  /** Retain the submitting client so status reads use the same service and chain. */
  client: Pick<SpotClient, "chainId" | "getOrder">;
  order: Order;
  signal?: AbortSignal;
  pollIntervalMillis?: number;
  indexingGraceMillis?: number;
}

function pause(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Serial status reads, bounded by the signed deadline plus an indexing grace period. */
export async function* watchOrder({
  client, order, signal, pollIntervalMillis = 2_000, indexingGraceMillis = 60_000,
}: WaitForOrderParams): AsyncGenerator<Order, void, unknown> {
  if (!order.id || !Number.isSafeInteger(order.chainId) || order.chainId <= 0
    || client.chainId !== order.chainId || !Number.isFinite(order.deadline) || order.deadline <= 0
    || !Number.isFinite(pollIntervalMillis) || pollIntervalMillis <= 0
    || !Number.isFinite(indexingGraceMillis) || indexingGraceMillis < 0) {
    throw new Error("A valid accepted order and its submitting client are required for tracking");
  }
  const end = order.deadline + indexingGraceMillis;
  let interval = pollIntervalMillis;
  let current = order;
  const assertActive = () => {
    if (signal?.aborted) throw new OrderSettlementError("Swap tracking stopped. Check order history before retrying.", "aborted", order.id);
  };
  while (true) {
    assertActive();
    if (current.status !== OrderStatus.Open) {
      yield current;
      if (current.status === OrderStatus.Completed) return;
      if (current.status === OrderStatus.Cancelled) throw new OrderSettlementError("Swap order was cancelled.", "cancelled", order.id);
      if (current.status === OrderStatus.Expired) throw new OrderSettlementError("Swap order expired before completion.", "expired", order.id);
    }
    const remaining = end - Date.now();
    if (remaining <= 0) throw new OrderSettlementError("Swap fill could not be confirmed. Check order history before retrying.", "unconfirmed", order.id);
    const timeout = AbortSignal.timeout(Math.max(1, Math.min(15_000, Math.ceil(remaining))));
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let next: Order | undefined;
    try {
      next = await client.getOrder({ orderId: order.id, signal: requestSignal });
    } catch {
      assertActive();
      // A read failure says nothing about the accepted order. Retry within its bound.
    }
    assertActive();
    if (next?.id.toLowerCase() === order.id.toLowerCase() && next.chainId === order.chainId) {
      current = next;
      interval = pollIntervalMillis;
      if (current.status !== OrderStatus.Open) continue;
      yield current;
    } else {
      interval = Math.min(30_000, interval * 2);
    }
    const delay = Math.min(interval, end - Date.now());
    if (delay > 0) {
      try { await pause(delay, signal); } catch { assertActive(); }
    }
  }
}

export async function waitForOrder(params: WaitForOrderParams): Promise<Order> {
  let latest = params.order;
  for await (const current of watchOrder(params)) latest = current;
  return latest;
}
