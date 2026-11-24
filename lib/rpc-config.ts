/** A chain-aware gateway is optional when per-chain endpoints are configured. */
export function getRpcGateway(): string | undefined {
  const value = process.env.RPC_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch { throw new Error("RPC_URL must be a valid HTTP(S) URL"); }
  return value;
}

/** Parse per-chain RPC endpoints without exposing them to the browser. */
export function getRpcUrls(): Record<string, string> | undefined {
  const raw = process.env.RPC_URLS;
  if (!raw) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("RPC_URLS must be a JSON object mapping chain IDs to URLs"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RPC_URLS must be a JSON object mapping chain IDs to URLs");
  const entries = Object.entries(value);
  if (!entries.length) throw new Error("RPC_URLS must contain at least one chain URL");
  for (const [chain, endpoint] of entries) {
    if (!/^[1-9]\d*$/.test(chain) || !Number.isSafeInteger(Number(chain)) || typeof endpoint !== "string") {
      throw new Error("RPC_URLS must map positive chain IDs to HTTP(S) URLs");
    }
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch { throw new Error(`RPC_URLS has an invalid URL for chain ${chain}`); }
  }
  return value as Record<string, string>;
}
