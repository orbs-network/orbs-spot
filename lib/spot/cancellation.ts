import type { Order, SpotClient } from "@orbs-network/spot-ui";
import type { SpotWalletPort } from "./execution";

// Different UI controls may cancel the same order. Share a lock across callers;
// historyKey distinguishes orders from different protocol versions.
const pending = new Set<string>();

/** SDK chooses the contract, ABI and arguments for both legacy and v2 orders. */
export async function cancelOrder(
  client: SpotClient,
  wallet: SpotWalletPort,
  order: Order,
  account: string,
): Promise<`0x${string}`> {
  if (
    client.chainId !== order.chainId ||
    order.maker.toLowerCase() !== account.toLowerCase()
  ) {
    throw new Error("Wallet does not match this order");
  }
  const key = `${client.partner}:${order.chainId}:${order.historyKey}`;
  if (pending.has(key)) throw new Error("Cancellation is already pending");
  pending.add(key);
  try {
    await wallet.assertContext(account, client.chainId);
    // Await the confirmed write inside try so the lock is held until it settles.
    return await wallet.cancelOrder(client.getCancelOrderRequest(order));
  } finally {
    pending.delete(key);
  }
}
