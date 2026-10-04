import { getBalances, MAX_BALANCE_TOKENS } from "@/lib/get-balances";
import { isNativeAddress, uniqueTokenAddresses } from "@/lib/utils";
import { isRecord, parseSupportedChainId, readJsonBody, RequestError } from "@/lib/server/request";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body)) throw new RequestError("A JSON object is required");
    const chainId = parseSupportedChainId(body.chainId);
    const { address, tokens } = body;
    if (typeof address !== "string" || !isAddress(address)) throw new RequestError("A valid wallet address is required");
    if (!Array.isArray(tokens) || tokens.length > MAX_BALANCE_TOKENS) {
      throw new RequestError(`tokens must be an array of at most ${MAX_BALANCE_TOKENS} addresses`);
    }
    if (tokens.some(token => typeof token !== "string" || (!isNativeAddress(token) && !isAddress(token)))) {
      throw new RequestError("tokens must be valid token addresses");
    }
    const balances = await getBalances(chainId, address, uniqueTokenAddresses(tokens));
    return NextResponse.json(balances, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestError ? error.message : "Failed to get balances" },
      { status: error instanceof RequestError ? error.status : 502 },
    );
  }
}
