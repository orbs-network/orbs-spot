import {
  getParaswapTokenAddress,
  isParaswapTokenAddress,
  shouldTreatParaswapAsNoRoute,
  type ParaswapDeltaQuoteResponse,
  type ParaswapPriceRoute,
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
      { error: "Invalid ParaSwap quote parameters" },
      { status: 400 },
    );
  }

  const sdk = createParaswapSdk(chainId);
  const quoteParams = {
    amount,
    destDecimals,
    destToken: getParaswapTokenAddress(destToken),
    partner,
    side: "SELL" as const,
    srcDecimals,
    srcToken: getParaswapTokenAddress(srcToken),
    userAddress: userAddress ?? undefined,
  };
  const [deltaQuoteResult, marketQuoteResult] = await Promise.allSettled([
    sdk.quote.getQuote({
      ...quoteParams,
      mode: "all",
    }),
    sdk.quote.getQuote({
      ...quoteParams,
      mode: "market",
    }),
  ]);

  const deltaQuote =
    deltaQuoteResult.status === "fulfilled" ? deltaQuoteResult.value : undefined;
  const marketQuote =
    marketQuoteResult.status === "fulfilled"
      ? marketQuoteResult.value
      : undefined;
  const market = (
    (deltaQuote as ParaswapDeltaQuoteResponse | undefined)?.market ??
    marketQuote?.market
  ) as ParaswapPriceRoute | undefined;

  if (deltaQuoteResult.status === "rejected" && !market?.destAmount) {
    const status = getParaswapSdkErrorStatus(deltaQuoteResult.reason) ?? 500;
    const noRoute = shouldTreatParaswapAsNoRoute(status);
    return NextResponse.json(
      {
        error:
          getParaswapSdkErrorMessage(deltaQuoteResult.reason) ??
          "ParaSwap route not found",
        noRoute,
      },
      { status: noRoute ? 404 : status },
    );
  }

  const result = deltaQuote as ParaswapDeltaQuoteResponse | undefined;

  if (!result?.delta?.route && !market?.destAmount) {
    const fallbackStatus =
      marketQuoteResult.status === "rejected"
        ? getParaswapSdkErrorStatus(marketQuoteResult.reason)
        : undefined;
    const noRoute = fallbackStatus
      ? shouldTreatParaswapAsNoRoute(fallbackStatus)
      : true;
    return NextResponse.json(
      {
        error:
          (marketQuoteResult.status === "rejected"
            ? getParaswapSdkErrorMessage(marketQuoteResult.reason)
            : undefined) ?? "ParaSwap route not found",
        noRoute,
      },
      { status: noRoute ? 404 : fallbackStatus ?? 404 },
    );
  }

  return NextResponse.json({
    delta: result?.delta,
    fallbackReason: result?.fallbackReason,
    market,
  } satisfies ParaswapDeltaQuoteResponse);
}
