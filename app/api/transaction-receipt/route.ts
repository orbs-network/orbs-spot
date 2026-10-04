import { getTxReceipt } from "@/lib/get-tx-receipt";
import { parseSupportedChainId, RequestError } from "@/lib/server/request";
import { NextResponse } from "next/server";

const serializeBigInt = (value: unknown) => JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item));

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const chainId = parseSupportedChainId(params.get("chainId"));
    const hash = params.get("hash");
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new RequestError("A 32-byte transaction hash is required");
    const receipt = await getTxReceipt(chainId, hash as `0x${string}`);
    return NextResponse.json(receipt ? serializeBigInt(receipt) : { status: "pending" }, {
      status: receipt ? 200 : 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestError ? error.message : "Failed to get transaction receipt" },
      { status: error instanceof RequestError ? error.status : 502 },
    );
  }
}
