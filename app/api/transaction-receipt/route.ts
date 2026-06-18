import { getTxReceipt } from "@/lib/get-tx-receipt";
import { NextResponse } from "next/server";
import { isHex } from "viem";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chainId");
  const hash = searchParams.get("hash");

  try {
    if (!chainId || !hash) {
      return NextResponse.json(
        { error: "chainId and hash are required" },
        { status: 400 }
      );
    }

    if (!isHex(hash)) {
      return NextResponse.json(
        { error: "hash is not a valid hex" },
        { status: 400 }
      );
    }

    const receipt = await getTxReceipt(Number(chainId), hash as `0x${string}`);


    return new NextResponse(
      JSON.stringify(receipt, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    );
  } catch (error) {
    console.error("Error in GET /api/transaction-receipt:", error);
    return NextResponse.json(
      { error: "Failed to get transaction receipt" },
      { status: 500 }
    );
  }
}
