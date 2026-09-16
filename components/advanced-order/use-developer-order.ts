"use client";

import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useClient, useOrders } from "./use-order-client";
import { useSubmitButton } from "./use-order-execution";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { getDemoOrderForm, DEMO_ACCOUNT, type DeveloperExecutionMode } from "../developer-tools/demo-order";
import { useSpotMarketReferencePrice } from "./hooks";
import { useOrderReview } from "./use-order-review";

/** Prepare the developer preview through the same client used for submission. */
export function useDeveloperOrder(mode: DeveloperExecutionMode = "demo") {
  const review = useOrderReview();
  const client = useClient();
  const market = useSpotMarketReferencePrice();
  const history = useOrders();
  const button = useSubmitButton();
  const { address: connectedAddress } = useConnection();
  const chainId = useDataChainId();
  const address = connectedAddress ?? (mode === "demo" ? DEMO_ACCOUNT : undefined);
  const form = useMemo(() => mode === "demo" ? getDemoOrderForm(review.form) : review.form, [mode, review.form]);
  const permit = useMemo(() => {
    if (!client.data || !form.canSubmit || !review.srcToken || !review.dstToken || !address) return;
    const inputTokenAddress = isNativeAddress(review.srcToken.address)
      ? getWrappedNativeCurrency(chainId)?.address
      : review.srcToken.address;
    if (!inputTokenAddress) return;
    const prepared = client.data.prepareOrder({ form, inputTokenAddress, outputTokenAddress: review.dstToken.address, swapperAddress: address });
    return { ...client.data.rePermitData, order: prepared.order };
  }, [address, chainId, client.data, form, review.srcToken, review.dstToken]);
  return {
    client: client.data,
    canDemoExecute: form.canSubmit && !market.isLoading && !market.noLiquidity,
    module: review.form.module,
    derivedFormData: { ...review, form, rePermitData: permit },
    fillDelayPanel: { fillDelay: review.form.schedule.fillDelay },
    durationPanel: { duration: review.form.schedule.duration },
    submitOrderButton: { ...button, error: client.error, loading: client.isLoading, retry: client.refetch },
    orderHistoryPanel: { refetchOrders: history.refetch },
  };
}
