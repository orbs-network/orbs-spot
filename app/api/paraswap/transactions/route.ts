import {
  getParaswapTokenAddress,
  isParaswapTokenAddress,
  type ParaswapPriceRoute,
  type ParaswapTransactionParams,
} from "@/lib/paraswap";
import {
  createParaswapSdk,
  getParaswapSdkErrorMessage,
  getParaswapSdkErrorStatus,
} from "@/lib/paraswap-sdk";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { OptimalRate } from "@velora-dex/sdk";

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseSlippageBps = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 10_000
    ? parsed
    : undefined;
};

const parseTokenDecimals = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 255
    ? parsed
    : undefined;
};

const isRawAmount = (value: unknown): value is string =>
  typeof value === "string" && /^\d+$/.test(value);

const isHexBytes = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x([0-9a-fA-F]{2})*$/.test(value);

const isPriceRoute = (value: unknown): value is ParaswapPriceRoute =>
  Boolean(
    value &&
      typeof value === "object" &&
      "destAmount" in value &&
      isRawAmount((value as ParaswapPriceRoute).destAmount),
  );

const parseBoolean = (value: unknown) => value === true || value === "true";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const chainId = parsePositiveInteger(body?.chainId);
  const priceRoute = body?.priceRoute;
  const srcToken = body?.srcToken;
  const destToken = body?.destToken;
  const srcDecimals = parseTokenDecimals(body?.srcDecimals);
  const destDecimals = parseTokenDecimals(body?.destDecimals);
  const amount = body?.amount;
  const userAddress = body?.userAddress;
  const slippageBps = parseSlippageBps(body?.slippageBps);
  const partner = body?.partner || "efficient-frontier";
  const ignoreChecks = parseBoolean(body?.ignoreChecks);
  const permit = body?.permit;
  const deadline =
    body?.deadline === undefined ? undefined : parsePositiveInteger(body?.deadline);

  if (
    !chainId ||
    !isPriceRoute(priceRoute) ||
    typeof srcToken !== "string" ||
    typeof destToken !== "string" ||
    srcDecimals === undefined ||
    destDecimals === undefined ||
    !isRawAmount(amount) ||
    typeof userAddress !== "string" ||
    !isAddress(userAddress) ||
    slippageBps === undefined ||
    !isParaswapTokenAddress(srcToken) ||
    !isParaswapTokenAddress(destToken) ||
    (permit !== undefined && !isHexBytes(permit)) ||
    (body?.deadline !== undefined && !deadline)
  ) {
    return NextResponse.json(
      { error: "Invalid ParaSwap transaction parameters" },
      { status: 400 },
    );
  }

  try {
    const txParams = await createParaswapSdk(chainId).swap.buildTx(
      {
        priceRoute: priceRoute as unknown as OptimalRate,
        srcToken: getParaswapTokenAddress(srcToken),
        destToken: getParaswapTokenAddress(destToken),
        userAddress,
        srcDecimals,
        destDecimals,
        srcAmount: amount,
        slippage: slippageBps,
        txOrigin: userAddress,
        partner,
        permit,
        deadline: deadline?.toString(),
      },
      {
        ignoreChecks,
      },
    );

    return NextResponse.json(txParams as ParaswapTransactionParams);
  } catch (error) {
    return NextResponse.json(
      {
        error: getParaswapSdkErrorMessage(error) ?? "Failed to build ParaSwap transaction",
      },
      { status: getParaswapSdkErrorStatus(error) ?? 500 },
    );
  }
}
