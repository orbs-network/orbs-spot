import {
  getParaswapTokenAddress,
  isParaswapTokenAddress,
  shouldTreatParaswapAsNoRoute,
  type ParaswapQuoteResponse,
} from "@/lib/paraswap";
import {
  createParaswapSdk,
  getParaswapSdkErrorMessage,
  getParaswapSdkErrorStatus,
} from "@/lib/paraswap-sdk";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

const parsePositiveInteger = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseTokenDecimals = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 255
    ? parsed
    : undefined;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = parsePositiveInteger(searchParams.get("chainId"));
  const srcToken = searchParams.get("srcToken");
  const destToken = searchParams.get("destToken");
  const srcDecimals = parseTokenDecimals(searchParams.get("srcDecimals"));
  const destDecimals = parseTokenDecimals(searchParams.get("destDecimals"));
  const amount = searchParams.get("amount");
  const userAddress = searchParams.get("userAddress");
  const partner = searchParams.get("partner") || "efficient-frontier";

  if (
    !chainId ||
    !srcToken ||
    !destToken ||
    srcDecimals === undefined ||
    destDecimals === undefined ||
    !amount ||
    !/^\d+$/.test(amount) ||
    !isParaswapTokenAddress(srcToken) ||
    !isParaswapTokenAddress(destToken) ||
    (userAddress && !isAddress(userAddress))
  ) {
    return NextResponse.json(
      { error: "Invalid ParaSwap price parameters" },
      { status: 400 },
    );
  }

  try {
    const result = await createParaswapSdk(chainId).quote.getQuote({
      amount,
      destDecimals,
      destToken: getParaswapTokenAddress(destToken),
      mode: "market",
      partner,
      side: "SELL",
      srcDecimals,
      srcToken: getParaswapTokenAddress(srcToken),
      userAddress: userAddress ?? undefined,
    });

    if (!result?.market?.destAmount) {
      return NextResponse.json(
        { error: "ParaSwap route not found", noRoute: true },
        { status: 404 },
      );
    }

    return NextResponse.json({
      priceRoute: result.market,
    } satisfies ParaswapQuoteResponse);
  } catch (error) {
    const status = getParaswapSdkErrorStatus(error) ?? 500;
    const noRoute = shouldTreatParaswapAsNoRoute(status);
    return NextResponse.json(
      {
        error: getParaswapSdkErrorMessage(error) ?? "ParaSwap route not found",
        noRoute,
      },
      { status: noRoute ? 404 : status },
    );
  }
}
