import { isRecord, RequestError } from "./request";

// Only the reads needed by the public client are exposed through our RPC key.
const READ_METHODS = new Set([
  "eth_chainId", "net_version", "eth_blockNumber", "eth_call", "eth_estimateGas",
  "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory", "eth_getBalance",
  "eth_getCode", "eth_getStorageAt", "eth_getTransactionCount", "eth_getLogs",
  "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getTransactionByHash",
  "eth_getTransactionReceipt", "eth_getProof",
]);

export function validateRpcRequest(body: unknown): void {
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > 50) throw new RequestError("RPC batches must contain 1–50 requests");
  for (const call of calls) {
    if (!isRecord(call) || call.jsonrpc !== "2.0" ||
      typeof call.method !== "string" || !READ_METHODS.has(call.method) ||
      !(call.id === null || typeof call.id === "string" || typeof call.id === "number") ||
      (call.params !== undefined && !Array.isArray(call.params))) {
      throw new RequestError("Invalid or unsupported RPC request");
    }
  }
}
