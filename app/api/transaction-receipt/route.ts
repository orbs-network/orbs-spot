import { getTxReceipt } from "@/lib/get-tx-receipt";
import { NextResponse } from "next/server";
import { isHex } from "viem";

const serializeBigInt = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );

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

    const parsedChainId = Number(chainId);
    if (!Number.isInteger(parsedChainId)) {
      return NextResponse.json(
        { error: "chainId must be an integer" },
        { status: 400 },
      );
    }

    if (!isHex(hash)) {
      return NextResponse.json(
        { error: "hash is not a valid hex" },
        { status: 400 }
      );
    }

    const receipt = await getTxReceipt(parsedChainId, hash as `0x${string}`);
    return NextResponse.json(serializeBigInt(receipt));
  } catch (error) {
    console.error("Error in GET /api/transaction-receipt:", error);
    return NextResponse.json(
      { error: "Failed to get transaction receipt" },
      { status: 500 }
    );
  }
}
