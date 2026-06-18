import { getBalances, MAX_BALANCE_TOKENS } from "@/lib/get-balances";
import { isNativeAddress, uniqueTokenAddresses } from "@/lib/utils";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

const parseChainId = (value: unknown) => {
  const chainId = Number(value);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : null;
};

export async function POST(request: Request) {
  try {
    const { chainId: rawChainId, address, tokens } = await request.json();
    const chainId = parseChainId(rawChainId);

    if (!chainId || typeof address !== "string" || !Array.isArray(tokens)) {
      return NextResponse.json(
        { error: "chainId, address and tokens are required" },
        { status: 400 }
      );
    }

    if (!isAddress(address)) {
      return NextResponse.json(
        { error: "address must be a valid wallet address" },
        { status: 400 }
      );
    }

    const normalizedTokens = uniqueTokenAddresses(tokens);

    if (normalizedTokens.length > MAX_BALANCE_TOKENS) {
      return NextResponse.json(
        { error: `Too many tokens requested. Max is ${MAX_BALANCE_TOKENS}` },
        { status: 400 }
      );
    }

    const hasInvalidToken = tokens.some(
      (token) =>
        typeof token !== "string" || (!isNativeAddress(token) && !isAddress(token))
    );

    if (hasInvalidToken) {
      return NextResponse.json(
        { error: "tokens must be valid token addresses" },
        { status: 400 }
      );
    }

    const balances = await getBalances(chainId, address, normalizedTokens);
    return NextResponse.json(balances);
  } catch (error) {
    console.error("Error in POST /api/balances:", error);
    return NextResponse.json({ error: "Failed to get balances" }, { status: 500 });
  }
}
