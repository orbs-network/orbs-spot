import { rpcRateLimitResponse } from "@/lib/server/rpc-limit";
import { NextRequest, NextResponse } from "next/server";
import { assertRpcChain, getRpcUrl, RpcConfigurationError } from "@/lib/rpc-url";
import { parseSupportedChainId, readJsonBody, RequestError } from "@/lib/server/request";
import { validateRpcRequest } from "@/lib/server/rpc-request";

export async function POST(request: NextRequest) {
  const limited = rpcRateLimitResponse();
  if (limited) return limited;
  try {
    const chainId = parseSupportedChainId(request.nextUrl.searchParams.get("chainId"));
    const body = await readJsonBody(request);
    validateRpcRequest(body);
    await assertRpcChain(chainId);
    request.signal.throwIfAborted();
    const response = await fetch(getRpcUrl(chainId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Upstream RPC failed");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestError || error instanceof RpcConfigurationError ? error.message : "Network request failed. Please retry." },
      { status: error instanceof RequestError ? error.status : 502 },
    );
  }
}
