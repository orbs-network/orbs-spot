import { SUPPORTED_CHAINS } from "@/lib/consts";

const chainIds = new Set<number>(SUPPORTED_CHAINS.map(chain => chain.id));
export const MAX_REQUEST_BYTES = 128 * 1024;

export class RequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function parseSupportedChainId(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value))) {
    throw new RequestError("A supported chainId is required");
  }
  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || !chainIds.has(chainId)) {
    throw new RequestError("Unsupported chainId");
  }
  return chainId;
}

/** Bound streamed bodies as well as declared Content-Length. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new RequestError("Request body is too large", 413);
  }
  if (!request.body) throw new RequestError("A JSON body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestError("Request body is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); }
    catch { throw new RequestError("Invalid JSON body"); }
  } finally { reader.releaseLock(); }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
