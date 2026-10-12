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

/** Combine v2 digests only when every SDK request targets the same contract. */
export async function cancelOrderBatch(client: SpotClient, wallet: SpotWalletPort, orders: Order[], account: string) {
  if (!orders.length) throw new Error("No orders selected");
  if (orders.some(order => order.chainId !== client.chainId || order.maker.toLowerCase() !== account.toLowerCase() || order.status !== "OPEN")) throw new Error("Selected orders no longer match the wallet or network");
  const requests = orders.map(order => client.getCancelOrderRequest(order));
  const first = requests[0];
  if (orders.length > 1 && (orders.some(order => order.version !== 2) || requests.some(request => request.contractAddress.toLowerCase() !== first.contractAddress.toLowerCase()))) throw new Error("These orders require separate cancellations");
  const keys = orders.map(order => `${client.partner}:${order.chainId}:${order.historyKey}`);
  if (keys.some(key => pending.has(key))) throw new Error("Cancellation is already pending");
  keys.forEach(key => pending.add(key));
  try {
    await wallet.assertContext(account, client.chainId);
    const args = orders.length === 1 ? first.args : [requests.flatMap(request => request.args[0] as string[])];
    return await wallet.cancelOrder({ ...first, args });
  } finally { keys.forEach(key => pending.delete(key)); }
}
