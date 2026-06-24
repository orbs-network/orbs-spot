import {
  isParaswapDeltaRoute,
  type ParaswapDeltaBuildResponse,
} from "@/lib/paraswap";
import {
  createParaswapSdk,
  getParaswapSdkErrorMessage,
  getParaswapSdkErrorStatus,
} from "@/lib/paraswap-sdk";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { DeltaRoute } from "@velora-dex/sdk";

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

const parseSide = (value: unknown) =>
  value === "BUY" || value === "SELL" ? value : "SELL";

const isHexBytes = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x([0-9a-fA-F]{2})*$/.test(value);

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const route = body?.route;
  const chainId = parsePositiveInteger(route?.origin?.input?.token?.chainId);
  const owner = body?.owner;
  const deadline = parsePositiveInteger(body?.deadline);
  const slippageBps = parseSlippageBps(body?.slippageBps);
  const partner = body?.partner || "efficient-frontier";
  const side = parseSide(body?.side);
  const permit = body?.permit;

  if (
    !chainId ||
    !isParaswapDeltaRoute(route) ||
    typeof owner !== "string" ||
    !isAddress(owner) ||
    !deadline ||
    slippageBps === undefined ||
    (permit !== undefined && !isHexBytes(permit))
  ) {
    return NextResponse.json(
      { error: "Invalid ParaSwap Delta build parameters" },
      { status: 400 },
    );
  }

  try {
    const builtOrder = await createParaswapSdk(chainId).delta.buildDeltaOrder({
      route: route as unknown as DeltaRoute,
      owner,
      deadline,
      side,
      slippage: slippageBps,
      partner,
      permit,
    });

    return NextResponse.json(builtOrder as ParaswapDeltaBuildResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          getParaswapSdkErrorMessage(error) ??
          "Failed to build ParaSwap Delta order",
      },
      { status: getParaswapSdkErrorStatus(error) ?? 500 },
    );
  }
}
