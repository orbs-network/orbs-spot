import {
  type ParaswapDeltaOrder,
} from "@/lib/paraswap";
import {
  createParaswapSdk,
  getParaswapSdkErrorMessage,
  getParaswapSdkErrorStatus,
} from "@/lib/paraswap-sdk";
import { NextResponse } from "next/server";
import type { DeltaOrderToPost } from "@velora-dex/sdk";

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const isHex = (value: unknown) =>
  typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const chainId = parsePositiveInteger(body?.chainId);
  const order = body?.order;
  const signature = body?.signature;
  const partner = body?.partner || "efficient-frontier";

  if (
    !chainId ||
    !order ||
    typeof order !== "object" ||
    !isHex(signature)
  ) {
    return NextResponse.json(
      { error: "Invalid ParaSwap Delta order parameters" },
      { status: 400 },
    );
  }

  try {
    const submittedOrder = await createParaswapSdk(chainId).delta.postDeltaOrder({
      order: order as DeltaOrderToPost["order"],
      signature,
      partner,
      type: "MARKET",
      partiallyFillable: false,
    });

    return NextResponse.json(submittedOrder as ParaswapDeltaOrder);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          getParaswapSdkErrorMessage(error) ??
          "Failed to submit ParaSwap Delta order",
      },
      { status: getParaswapSdkErrorStatus(error) ?? 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const chainId = parsePositiveInteger(searchParams.get("chainId")) ?? 1;

  if (!orderId || !/^[a-zA-Z0-9-]+$/.test(orderId)) {
    return NextResponse.json(
      { error: "Invalid ParaSwap Delta order id" },
      { status: 400 },
    );
  }

  try {
    const order = await createParaswapSdk(chainId).delta.getDeltaOrderById(orderId);
    return NextResponse.json(order as ParaswapDeltaOrder);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          getParaswapSdkErrorMessage(error) ??
          "Failed to fetch ParaSwap Delta order",
      },
      { status: getParaswapSdkErrorStatus(error) ?? 500 },
    );
  }
}
