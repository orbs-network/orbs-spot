const emptyKeys: readonly string[] = [];
export const swapOrderKey = (chainId: number, orderId: string) => `${chainId}:${orderId.toLowerCase()}`;

/** Foreground ownership is independent of background settlement and recovery. */
export function createSwapSubmissions() {
  let foreground: string | undefined;
  const orders = new Map<string, string>();
  let orderKeys = emptyKeys;
  const listeners = new Set<() => void>();
  const publish = () => {
    orderKeys = [...orders.values()];
    for (const listener of listeners) listener();
  };
  return {
    begin(id: string) { foreground = id; },
    current: () => foreground,
    isCurrent: (id: string) => foreground === id,
    detach(id: string) { if (foreground === id) foreground = undefined; },
    track(id: string, chainId: number, orderId: string) { orders.set(id, swapOrderKey(chainId, orderId)); publish(); },
    finish(id: string) { if (orders.delete(id)) publish(); },
    getOrderKeys: () => orderKeys,
    getServerOrderKeys: () => emptyKeys,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const swapSubmissions = createSwapSubmissions();
