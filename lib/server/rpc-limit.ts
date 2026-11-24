/** A per-instance ceiling helps protect upstream RPC quota; a shared edge limit is also required. */
const WINDOW_MS = 60_000;
let windowStarted = 0;
let requests = 0;

export function rpcRateLimitResponse(): Response | undefined {
  const setting = process.env.RPC_RATE_LIMIT_PER_MINUTE;
  const parsed = setting === undefined || setting === "" ? 600 : Number(setting);
  const limit = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 600;
  if (limit === 0) return undefined;
  const now = Date.now();
  if (now - windowStarted >= WINDOW_MS || now < windowStarted) {
    windowStarted = now;
    requests = 0;
  }
  if (requests >= limit) {
    return Response.json({ error: "RPC request limit reached. Please retry shortly." }, {
      status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((windowStarted + WINDOW_MS - now) / 1000))), "Cache-Control": "no-store" },
    });
  }
  requests += 1;
  return undefined;
}
